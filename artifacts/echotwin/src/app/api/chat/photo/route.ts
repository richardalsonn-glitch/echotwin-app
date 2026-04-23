import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAiErrorResponse } from "@/lib/ai/errors";
import { runPersonaChatGeneration } from "@/lib/ai/agent";
import { analyzeChatImage, createFallbackImageAnalysis, type ChatImageAnalysis } from "@/lib/ai/image";
import type { PersonaChatGenerationResult } from "@/lib/ai/types";
import { buildChatResponsePrompt } from "@/lib/ai/prompts";
import { isLanguage, type Language } from "@/lib/i18n";
import { canSendMessage } from "@/lib/subscription/limits";
import { shouldQueuePersonaVoiceMessage } from "@/lib/voice/message";
import { getMediaMemoryItems } from "@/lib/media/memory";
import { validateImageFile } from "@/lib/media/limits";
import { CHAT_MEDIA_BUCKET, createChatMediaStoragePath } from "@/lib/media/storage";
import type { ChatMessage, Persona, PersonaAnalysis } from "@/types/persona";
import type { SubscriptionTier } from "@/types/subscription";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const personaId = formData.get("persona_id");
  const image = formData.get("image");
  const captionValue = formData.get("caption");
  const languageValue = formData.get("language");
  const language = isLanguage(languageValue) ? languageValue : "tr";
  const caption =
    typeof captionValue === "string" && captionValue.trim() ? captionValue.trim() : null;

  if (typeof personaId !== "string" || !personaId.trim()) {
    return NextResponse.json({ error: "persona_id gerekli" }, { status: 400 });
  }

  if (!isUploadedFile(image)) {
    return NextResponse.json({ error: "Fotograf dosyasi bulunamadi" }, { status: 400 });
  }

  const validation = validateImageFile(image);
  if (!validation.ok) {
    console.warn("[chat-photo] rejected image", {
      reason: validation.debugMessage,
      type: image.type,
      size: image.size,
    });
    return NextResponse.json({ error: validation.userMessage }, { status: validation.status });
  }

  const { data: persona, error: personaError } = await supabase
    .from("personas")
    .select("*")
    .eq("id", personaId)
    .eq("user_id", user.id)
    .single();

  if (personaError || !persona) {
    return NextResponse.json({ error: "Persona bulunamadi" }, { status: 404 });
  }

  const typedPersona = persona as Persona;
  if (!typedPersona.analysis) {
    return NextResponse.json(
      { error: "Bu profil henuz analiz edilmemis" },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const tier = toSubscriptionTier(profile?.subscription_tier);
  const { allowed, reason } = canSendMessage(tier, typedPersona.message_count_used);
  if (!allowed) {
    return NextResponse.json(
      { error: reason, upgrade_required: true, limit_reached: true },
      { status: 403 }
    );
  }

  const { data: history } = await supabase
    .from("messages")
    .select("role, content, message_type")
    .eq("persona_id", personaId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const conversationHistory = (history ?? []).reverse().map((message) => ({
    role: message.role as "user" | "assistant",
    content:
      message.message_type === "image"
        ? `[Fotograf mesaji] ${message.content}`
        : message.content,
  }));
  const conversationContext = conversationHistory
    .slice(-10)
    .map((message) => `${message.role === "user" ? "Kullanici" : "AI"}: ${message.content}`)
    .join("\n");

  const storagePath = createChatMediaStoragePath({
    userId: user.id,
    scopeId: personaId,
    fileName: image.name || "photo.jpg",
  });
  const { error: uploadError } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(storagePath, image, {
      upsert: false,
      contentType: image.type || "image/jpeg",
    });

  if (uploadError) {
    console.error("[chat-photo] upload failed", uploadError);
    return NextResponse.json(
      { error: "Fotograf yuklenemedi, tekrar dene" },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(storagePath);
  const imageUrl = urlData.publicUrl;
  const mediaMemory = await loadMediaMemoryForPersona({
    supabase,
    userId: user.id,
    exportId: typedPersona.export_id,
  });
  const imageAnalysis = await getSafeImageAnalysis({
    imageUrl,
    caption,
    conversationContext,
    mediaMemory,
  });

  const now = new Date().toISOString();
  const userContent = caption ?? "Fotograf gonderildi";
  const { data: userMessage, error: userMessageError } = await supabase
    .from("messages")
    .insert({
      persona_id: personaId,
      user_id: user.id,
      role: "user",
      content: userContent,
      message_type: "image",
      image_url: imageUrl,
      media_mime_type: image.type || "image/jpeg",
      media_size_bytes: image.size,
      media_metadata: {
        caption,
        storage_path: storagePath,
        image_analysis: imageAnalysis,
      },
      created_at: now,
    })
    .select("*")
    .single();

  if (userMessageError || !userMessage) {
    console.error("[chat-photo] user message save failed", userMessageError);
    return NextResponse.json(
      { error: "Fotograf mesaji kaydedilemedi" },
      { status: 500 }
    );
  }

  const systemPrompt = buildImageAwareSystemPrompt(
    typedPersona,
    typedPersona.analysis,
    imageAnalysis,
    language,
    typedPersona.analysis_summary_cache ?? null,
    conversationHistory
  );
  const aiUserMessage = buildImageAwareUserMessage(caption, imageAnalysis);
  const assistantContent = await createAssistantPhotoReply({
    systemPrompt,
    conversationHistory,
    userMessage: aiUserMessage,
  });
  const nextMessageCount = typedPersona.message_count_used + 1;

  const { data: assistantMessage, error: assistantMessageError } = await supabase
    .from("messages")
    .insert({
      persona_id: personaId,
      user_id: user.id,
      role: "assistant",
      content: assistantContent.reply,
      message_type: "text",
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (assistantMessageError || !assistantMessage) {
    console.error("[chat-photo] assistant message save failed", assistantMessageError);
    return NextResponse.json(
      { error: "Fotograf yorumu kaydedilemedi" },
      { status: 500 }
    );
  }

  await supabase
    .from("personas")
    .update({
      message_count_used: nextMessageCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", personaId)
    .eq("user_id", user.id);

  return NextResponse.json({
    user_message: userMessage as ChatMessage,
    assistant_message: assistantMessage as ChatMessage,
    message_count_used: nextMessageCount,
    voice_message_pending: shouldQueuePersonaVoiceMessage(
      typedPersona,
      tier,
      nextMessageCount
    ),
    image_analysis: imageAnalysis,
    reply: assistantContent.reply,
    realism_score: assistantContent.realismScore,
    matched_style_signals: assistantContent.matchedStyleSignals,
    rejected_for_ai_tone: assistantContent.rejectedForAiTone,
    fallback_used: assistantContent.fallbackUsed,
    model_used: assistantContent.modelUsed,
  });
}

type PhotoSupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function loadMediaMemoryForPersona(params: {
  supabase: PhotoSupabaseClient;
  userId: string;
  exportId: string | null;
}) {
  if (!params.exportId) return [];

  const { data } = await params.supabase
    .from("chat_exports")
    .select("parsed_data")
    .eq("id", params.exportId)
    .eq("user_id", params.userId)
    .single();

  return getMediaMemoryItems(data?.parsed_data);
}

async function getSafeImageAnalysis(params: Parameters<typeof analyzeChatImage>[0]) {
  try {
    return await analyzeChatImage(params);
  } catch (error) {
    const aiError = getAiErrorResponse(error);
    console.warn("[chat-photo] image analysis fallback", {
      code: aiError.code,
      upstreamStatusCode: aiError.upstreamStatusCode,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return createFallbackImageAnalysis(params.caption);
  }
}

function buildImageAwareSystemPrompt(
  persona: Persona,
  analysis: PersonaAnalysis,
  imageAnalysis: ChatImageAnalysis,
  language: Language,
  analysisSummaryCache: Record<string, unknown> | null,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): string {
  return `${buildChatResponsePrompt({
    targetName: persona.target_name,
    requesterName: persona.requester_name,
    analysis,
    responseLanguage: language,
    conversationHistory,
    analysisSummaryCache,
  })}

EK FOTOGRAF KURALLARI:
- Kullanici fotograf gonderdi. Sen fotograf gonderme; sadece normal metin mesaji yaz.
- Fotograf baglamla alakaliysa sohbet konusunu koru ve fotografi o konu uzerinden dogal yorumla.
- Fotograf baglamla alakasizsa sadece fotografi yorumla, onceki konuyu zorla baglama.
- Fotograf neyle ilgiliyse cevabi dogrudan ona bagla; "fotoğrafı gördüm" gibi bos gecis cumleleriyle yetinme.
- Sohbeti devam ettirecek kadar kisa ve dogal tepki ver; gerekiyorsa tek bir hafif yorum veya tek dogal soru ekle.
- Gecmis medya hafizasina yalnizca memory_match "strong" ise dogal ve kisa sekilde degin. "Hatirliyorum" gibi kesin iddialar kurma; "buna benzer bir sey daha atmisti" gibi temkinli ol.
- Teknik analiz, JSON, sistem mesaji veya yapay zeka oldugunu soyleme.

FOTOGRAF ANALIZI:
${JSON.stringify(imageAnalysis)}`;
}

function buildImageAwareUserMessage(
  caption: string | null,
  imageAnalysis: ChatImageAnalysis
): string {
  return `Kullanici fotograf gonderdi.${caption ? ` Notu: ${caption}` : ""}

Fotograf ozeti: ${imageAnalysis.description}
Baglam iliskisi: ${imageAnalysis.topic_relation}
${imageAnalysis.conversation_bridge ? `Baglanti notu: ${imageAnalysis.conversation_bridge}` : ""}
${imageAnalysis.memory_note ? `Gecmis medya notu: ${imageAnalysis.memory_note}` : ""}

Bu mesaja ${imageAnalysis.topic_relation === "unrelated" ? "sadece fotograf uzerinden" : "sohbet baglamini koruyarak"} cevap ver.`;
}

async function createAssistantPhotoReply(params: {
  systemPrompt: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}): Promise<PersonaChatGenerationResult> {
  try {
    const aiResult = await runPersonaChatGeneration(params);
    return {
      ...aiResult,
      reply: aiResult.reply.trim() || "Fotografi gordum.",
    };
  } catch (error) {
    const aiError = getAiErrorResponse(error);
    console.warn("[chat-photo] persona reply fallback", {
      code: aiError.code,
      upstreamStatusCode: aiError.upstreamStatusCode,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      reply: "Fotografi gordum, su an cok net yorumlayamadim.",
      realismScore: 50,
      matchedStyleSignals: ["fallback_photo_reply"],
      rejectedForAiTone: false,
      fallbackUsed: true,
      modelUsed: "deterministic-photo-fallback",
      provider: "gemini",
      attempts: [],
    };
  }
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value !== "string" && value !== null;
}

function toSubscriptionTier(value: unknown): SubscriptionTier {
  return value === "basic" || value === "full" ? value : "free";
}
