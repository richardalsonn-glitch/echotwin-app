import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { createSupabaseClient } from "../lib/supabase.js";
import { openai } from "../lib/openai.js";
import { buildAnalysisPrompt, type PersonaAnalysis } from "../lib/prompts.js";
import type { Response } from "express";

const router = Router();

/** Extract conversation exchanges (requester → target pairs) for behavioral context */
function extractExchanges(
  messages: Array<{ sender: string; content: string; message_length: number }>,
  targetName: string,
  requesterName: string,
  limit = 20
): Array<{ user: string; target: string }> {
  const exchanges: Array<{ user: string; target: string }> = [];

  for (let i = 0; i < messages.length - 1; i++) {
    const cur = messages[i];
    const next = messages[i + 1];

    if (
      cur.sender === requesterName &&
      next.sender === targetName &&
      cur.content.trim().length >= 3 &&
      next.content.trim().length >= 3
    ) {
      exchanges.push({ user: cur.content.trim(), target: next.content.trim() });
      if (exchanges.length >= limit) break;
    }
  }

  return exchanges;
}

router.post("/analyze", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { persona_id } = req.body;

    if (!persona_id) {
      res.status(400).json({ error: "persona_id gerekli" });
      return;
    }

    const supabase = createSupabaseClient(req, res);

    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("*")
      .eq("id", persona_id)
      .eq("user_id", req.user!.id)
      .single();

    if (personaError || !persona) {
      res.status(404).json({ error: "Persona bulunamadı" });
      return;
    }

    const { data: cacheRecord, error: cacheError } = await supabase
      .from("chat_messages_cache")
      .select("messages")
      .eq("export_id", persona.export_id)
      .eq("user_id", req.user!.id)
      .single();

    if (cacheError || !cacheRecord) {
      res.status(404).json({ error: "Sohbet mesajları bulunamadı. Lütfen tekrar yükle." });
      return;
    }

    const messages = cacheRecord.messages as Array<{
      sender: string;
      content: string;
      has_question: boolean;
      message_length: number;
    }>;

    const targetMessages = messages.filter(
      (m) => m.sender === persona.target_name && m.content.trim().length >= 3
    );

    if (targetMessages.length < 5) {
      res.status(400).json({
        error: `${persona.target_name} adına yeterli mesaj bulunamadı (minimum 5 gerekli).`,
      });
      return;
    }

    // Extract conversation exchanges for behavioral context
    const exchanges = extractExchanges(
      messages,
      persona.target_name,
      persona.requester_name,
      20
    );

    const prompt = buildAnalysisPrompt(
      persona.target_name,
      persona.requester_name,
      messages,
      exchanges
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 3000,
      messages: [
        {
          role: "system",
          content:
            "Sen bir iletişim analistisin. Verilen mesajları analiz et ve YALNIZCA geçerli JSON döndür. " +
            "sample_messages alanına bu kişinin gerçek mesajlarını AYNEN kopyala, özetleme. " +
            "common_phrases alanına da gerçek ifadelerini kopyala.",
        },
        { role: "user", content: prompt },
      ],
    });

    const rawResponse = completion.choices[0]?.message?.content ?? "";

    let analysis: PersonaAnalysis;
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON bulunamadı");
      analysis = JSON.parse(jsonMatch[0]) as PersonaAnalysis;
    } catch {
      // Try to salvage partial JSON
      try {
        const fixedJson = rawResponse
          .replace(/,\s*}/, "}")
          .replace(/,\s*]/, "]")
          .match(/\{[\s\S]*\}/)?.[0];
        if (!fixedJson) throw new Error("Düzeltilemedi");
        analysis = JSON.parse(fixedJson) as PersonaAnalysis;
      } catch {
        res.status(500).json({ error: "AI analizi JSON olarak parse edilemedi. Tekrar dene." });
        return;
      }
    }

    // Ensure sample_messages is populated — fallback to last N target messages if AI didn't provide
    if (!analysis.sample_messages || analysis.sample_messages.length < 5) {
      analysis.sample_messages = targetMessages
        .filter((m) => m.content.trim().length >= 3 && m.content.trim().length < 200)
        .slice(-40)
        .map((m) => m.content.trim());
    }

    // Cap to 30 samples max
    analysis.sample_messages = analysis.sample_messages.slice(0, 30);

    const { data: updatedPersona, error: updateError } = await supabase
      .from("personas")
      .update({ analysis, updated_at: new Date().toISOString() })
      .eq("id", persona_id)
      .eq("user_id", req.user!.id)
      .select()
      .single();

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }

    res.json({ persona: updatedPersona, analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

export default router;
