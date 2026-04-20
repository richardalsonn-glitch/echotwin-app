import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openai } from "@/lib/ai/client";
import { getAiErrorResponse } from "@/lib/ai/errors";
import { buildChatSystemPrompt, calculateTypingDelay } from "@/lib/ai/prompts";
import { canSendMessage, getLimits } from "@/lib/subscription/limits";
import type { PersonaAnalysis } from "@/types/persona";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { persona_id, message } = await request.json();

    if (!persona_id || !message?.trim()) {
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

    const tier = (profile?.subscription_tier as "free" | "basic" | "full") ?? "free";
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

    const limits = getLimits(tier);
    const systemPrompt = buildChatSystemPrompt(
      persona.target_name,
      persona.requester_name,
      persona.analysis as PersonaAnalysis
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

          const aiStream = await openai.chat.completions.create({
            model: process.env.AI_CHAT_MODEL ?? limits.aiModel,
            max_completion_tokens: 512,
            temperature: 0.45,
            stream: true,
            messages: [
              { role: "system", content: systemPrompt },
              ...conversationHistory,
              { role: "user", content: message.trim() },
            ],
          });

          let fullResponse = "";

          for await (const chunk of aiStream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "chunk", content })}\n\n`)
              );
            }
          }

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
                message_count_used: persona.message_count_used + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", persona_id),
          ]);

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done", message_count_used: persona.message_count_used + 1 })}\n\n`)
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
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
