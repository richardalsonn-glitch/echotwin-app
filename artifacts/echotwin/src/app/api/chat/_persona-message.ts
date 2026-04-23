import { NextRequest, NextResponse } from "next/server";
import { getAiErrorResponse } from "@/lib/ai/errors";
import { runPersonaChatGeneration } from "@/lib/ai/agent";
import { buildChatResponsePrompt } from "@/lib/ai/prompts";
import { isLanguage } from "@/lib/i18n";
import { canSendMessage } from "@/lib/subscription/limits";
import { createClient } from "@/lib/supabase/server";
import type { PersonaAnalysis } from "@/types/persona";

type PersonaMessageMode = "start" | "idle";

type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

const MODE_CONFIG: Record<
  PersonaMessageMode,
  { systemInstruction: string; userMessage: string }
> = {
  start: {
    systemInstruction:
      "EK GOREV: Kullanici henuz mesaj atmadi. WhatsApp sohbetini sen baslat. Tek bir dogal, kisa ilk mesaj yaz. Analizdeki acilis, ton ve kelime aliskanliklarina uy. Bu teknik talimati mesajda belli etme.",
    userMessage: "Sohbeti dogal sekilde baslat.",
  },
  idle: {
    systemInstruction:
      "EK GOREV: Kullanici bir suredir cevap yazmiyor. Sohbeti zorlamadan surduren tek bir dogal, kisa mesaj yaz. Onceki konuya hafifce baglanabilir veya kisa bir yoklama yapabilirsin. Bu teknik talimati mesajda belli etme.",
    userMessage: "Bir sure sessizlik oldu. Dogal bir devam mesaji yaz.",
  },
};

export async function createPersonaMessage(
  request: NextRequest,
  mode: PersonaMessageMode
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const payload = isRecord(body) ? body : {};
    const persona_id = payload.persona_id;
    const language = isLanguage(payload.language) ? payload.language : "tr";

    if (typeof persona_id !== "string" || !persona_id) {
      return NextResponse.json({ error: "persona_id gerekli" }, { status: 400 });
    }

    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("*")
      .eq("id", persona_id)
      .eq("user_id", user.id)
      .single();

    if (personaError || !persona) {
      return NextResponse.json({ error: "Persona bulunamadi" }, { status: 404 });
    }

    if (!persona.analysis) {
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

    const tier = (profile?.subscription_tier as "free" | "basic" | "full") ?? "free";
    const { allowed, reason } = canSendMessage(tier, persona.message_count_used);

    if (!allowed) {
      return NextResponse.json(
        { error: reason, upgrade_required: true, limit_reached: true },
        { status: 403 }
      );
    }

    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("persona_id", persona_id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const conversationHistory: ChatHistoryMessage[] = (history ?? [])
      .reverse()
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      }));

    const config = MODE_CONFIG[mode];
    const systemPrompt = `${buildChatResponsePrompt({
      targetName: persona.target_name,
      requesterName: persona.requester_name,
      analysis: persona.analysis as PersonaAnalysis,
      responseLanguage: language,
      conversationHistory,
      analysisSummaryCache: persona.analysis_summary_cache ?? null,
    })}\n\n${config.systemInstruction}`;

    const aiResult = await runPersonaChatGeneration({
      systemPrompt,
      conversationHistory,
      userMessage: config.userMessage,
    });
    const trimmedContent = aiResult.reply.trim();
    if (!trimmedContent) {
      return NextResponse.json(
        { error: "AI bos mesaj dondurdu" },
        { status: 502 }
      );
    }

    const nextMessageCount = persona.message_count_used + 1;
    const now = new Date().toISOString();

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        persona_id,
        user_id: user.id,
        role: "assistant",
        content: trimmedContent,
        created_at: now,
      })
      .select("*")
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { error: messageError?.message ?? "Mesaj kaydedilemedi" },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("personas")
      .update({
        message_count_used: nextMessageCount,
        updated_at: now,
      })
      .eq("id", persona_id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      message,
      messages: [message],
      message_count_used: nextMessageCount,
      reply: trimmedContent,
      realism_score: aiResult.realismScore,
      matched_style_signals: aiResult.matchedStyleSignals,
      rejected_for_ai_tone: aiResult.rejectedForAiTone,
      fallback_used: aiResult.fallbackUsed,
      model_used: aiResult.modelUsed,
    });
  } catch (error) {
    const aiError = getAiErrorResponse(error);
    console.error("[chat-persona] failed", {
      code: aiError.code,
      status: aiError.status,
      upstreamStatusCode: aiError.upstreamStatusCode,
      message: error instanceof Error ? error.message : "Unknown error",
      mode,
    });
    return NextResponse.json(
      { error: aiError.message, code: aiError.code },
      { status: aiError.status }
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
