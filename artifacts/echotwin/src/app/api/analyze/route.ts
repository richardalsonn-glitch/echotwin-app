import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openai } from "@/lib/ai/client";
import { getAiErrorResponse } from "@/lib/ai/errors";
import { buildAnalysisPrompt } from "@/lib/ai/prompts";
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

    const { persona_id } = await request.json();

    if (!persona_id) {
      return NextResponse.json({ error: "persona_id gerekli" }, { status: 400 });
    }

    // Get persona
    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("*")
      .eq("id", persona_id)
      .eq("user_id", user.id)
      .single();

    if (personaError || !persona) {
      return NextResponse.json({ error: "Persona bulunamadı" }, { status: 404 });
    }

    // Get cached messages for this export
    const { data: cacheRecord, error: cacheError } = await supabase
      .from("chat_messages_cache")
      .select("messages")
      .eq("export_id", persona.export_id)
      .eq("user_id", user.id)
      .single();

    if (cacheError || !cacheRecord) {
      return NextResponse.json(
        { error: "Sohbet mesajları bulunamadı. Lütfen tekrar yükle." },
        { status: 404 }
      );
    }

    const messages = cacheRecord.messages as Array<{
      sender: string;
      content: string;
      has_question: boolean;
      message_length: number;
    }>;

    const targetMessages = messages.filter((m) => m.sender === persona.target_name);

    if (targetMessages.length < 5) {
      return NextResponse.json(
        { error: `${persona.target_name} adına yeterli mesaj bulunamadı (minimum 5 gerekli).` },
        { status: 400 }
      );
    }

    const prompt = buildAnalysisPrompt(
      persona.target_name,
      persona.requester_name,
      messages
    );

    // Call AI for persona extraction
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: process.env.AI_ANALYSIS_MODEL ?? "openai/gpt-oss-120b:free",
        max_completion_tokens: 2048,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "Sen bir iletişim analistisin. Yalnızca geçerli JSON döndür, başka hiçbir şey yazma.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });
    } catch (error) {
      const aiError = getAiErrorResponse(error);
      return NextResponse.json(
        { error: aiError.message, code: aiError.code },
        { status: aiError.status }
      );
    }

    const rawResponse = completion.choices[0]?.message?.content ?? "";

    // Strict JSON parse
    let analysis: PersonaAnalysis;
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON bulunamadı");
      analysis = JSON.parse(jsonMatch[0]) as PersonaAnalysis;
    } catch {
      return NextResponse.json(
        { error: "AI analizi JSON olarak parse edilemedi. Tekrar dene." },
        { status: 500 }
      );
    }

    // Save analysis to persona
    const { data: updatedPersona, error: updateError } = await supabase
      .from("personas")
      .update({
        analysis,
        updated_at: new Date().toISOString(),
      })
      .eq("id", persona_id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ persona: updatedPersona, analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
