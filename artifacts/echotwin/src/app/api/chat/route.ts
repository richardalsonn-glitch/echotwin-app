import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAiErrorResponse } from "@/lib/ai/errors";
import { runPersonaChat } from "@/lib/ai/agent";
import { buildChatSystemPrompt, calculateTypingDelay } from "@/lib/ai/prompts";
import { isLanguage } from "@/lib/i18n";
import { canSendMessage } from "@/lib/subscription/limits";
import { shouldQueuePersonaVoiceMessage } from "@/lib/voice/message";
import type { Persona, PersonaAnalysis } from "@/types/persona";
import type { SubscriptionTier } from "@/types/subscription";

export async function POST(request: NextRequest) {
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
    const message = payload.message;
    const language = isLanguage(payload.language) ? payload.language : "tr";

    if (typeof persona_id !== "string" || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "persona_id ve message gerekli" }, { status: 400 });
    }

    // Get persona and check limits
    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("*")
      .eq("id", persona_id)
      .eq("user_id", user.id)
      .single();

    if (personaError || !persona) {
      return NextResponse.json({ error: "Persona bulunamadı" }, { status: 404 });
    }

    if (!persona.analysis) {
      return NextResponse.json(
        { error: "Bu profil henüz analiz edilmemiş" },
        { status: 400 }
      );
    }

    // Get subscription tier and check limit
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    const tier = toSubscriptionTier(profile?.subscription_tier);
    const { allowed, reason } = canSendMessage(tier, persona.message_count_used);

    if (!allowed) {
      return NextResponse.json(
        { error: reason, upgrade_required: true, limit_reached: true },
        { status: 403 }
      );
    }

    // Get conversation history (last 20 messages)
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("persona_id", persona_id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const conversationHistory = (history ?? []).reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const systemPrompt = buildChatSystemPrompt(
      persona.target_name,
      persona.requester_name,
      persona.analysis as PersonaAnalysis,
      language
    );

    // Calculate typing delay before streaming
    const typingDelay = calculateTypingDelay(message);

    // Save user message
    await supabase.from("messages").insert({
      persona_id,
      user_id: user.id,
      role: "user",
      content: message.trim(),
    });

    // Stream response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send typing delay info
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "typing_delay", delay: typingDelay })}\n\n`)
          );

          // Small artificial delay for natural feel
          await new Promise((resolve) => setTimeout(resolve, Math.min(typingDelay, 2000)));

          const aiResult = await runPersonaChat({
            systemPrompt,
            conversationHistory,
            userMessage: message.trim(),
          });

          let fullResponse = "";

          for await (const content of aiResult.stream) {
            fullResponse += content;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "chunk", content })}\n\n`)
            );
          }

          const nextMessageCount = persona.message_count_used + 1;
          const voiceMessagePending = shouldQueuePersonaVoiceMessage(
            persona as Persona,
            tier,
            nextMessageCount
          );

          // Save assistant message and increment counter
          await Promise.all([
            supabase.from("messages").insert({
              persona_id,
              user_id: user.id,
              role: "assistant",
              content: fullResponse,
            }),
            supabase
              .from("personas")
              .update({
                message_count_used: nextMessageCount,
                updated_at: new Date().toISOString(),
              })
              .eq("id", persona_id),
          ]);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                content: fullResponse,
                message_count_used: nextMessageCount,
                voice_message_pending: voiceMessagePending,
              })}\n\n`
            )
          );
        } catch (error) {
          const aiError = getAiErrorResponse(error);
          const msg = aiError.message;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: msg, code: aiError.code })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const aiError = getAiErrorResponse(error);
    return NextResponse.json(
      { error: aiError.message, code: aiError.code },
      { status: aiError.status }
    );
  }
}

function toSubscriptionTier(value: unknown): SubscriptionTier {
  return value === "basic" || value === "full" ? value : "free";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
