import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { createSupabaseClient } from "../lib/supabase.js";
import { openai } from "../lib/openai.js";
import { buildChatSystemPrompt, calculateTypingDelay, type PersonaAnalysis } from "../lib/prompts.js";
import { canSendMessage, getLimits } from "../lib/limits.js";
import type { Response } from "express";

const router = Router();

function splitIntoMessages(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  let parts = trimmed.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  parts = trimmed.split(/\n/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  return [trimmed];
}

/** Get current hour in Istanbul timezone (UTC+3, no DST since 2016) */
function getIstanbulHour(): number {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 3 * 3_600_000).getHours();
}

/** Random integer between min and max (inclusive) */
function randMs(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

/**
 * Context-aware delay before the AI response is shown. Max 20 seconds.
 * Returns 0 for first 3 exchanges (immediate).
 * After that: driven purely by message content/mood — no time-of-day gating.
 */
function getContextualDelay(historyLength: number, userMessage: string): number {
  if (historyLength < 6) return 0;

  const MAX = 20_000; // hard cap: 20 seconds
  const msg = userMessage.trim().toLowerCase();

  const isQuestion =
    msg.endsWith("?") ||
    /\b(mı|mi|mu|mü|misin|mısın|musun|müsün|neden|nasıl|ne zaman|nerede|kim|ne|hangi|kaç)\b/.test(msg);
  const isUrgent =
    (msg.match(/!/g) ?? []).length >= 2 ||
    /\b(ya|ya be|neden|niye|hala|hâlâ|bekle|dur)\b/.test(msg);
  const isArgument =
    /\b(ama|yani|olmaz|saçma|anlamıyorsun|biliyorum|demedim mi|dedim|biliyorsun|bırak)\b/.test(msg);
  const isVeryShort = msg.replace(/\s+/g, "").length < 8;

  // Reactive / emotional → fastest
  if (isArgument || isUrgent) {
    const r = Math.random();
    if (r < 0.40) return randMs(1_500, 5_000);   // very fast (40%)
    if (r < 0.75) return randMs(5_000, 11_000);  // fast (35%)
    return randMs(11_000, MAX);                   // medium (25%)
  }

  // Questions → tends to reply quicker
  if (isQuestion) {
    const r = Math.random();
    if (r < 0.30) return randMs(2_000, 7_000);   // fast (30%)
    if (r < 0.65) return randMs(7_000, 13_000);  // medium (35%)
    return randMs(13_000, MAX);                   // slow (35%)
  }

  // Very short / casual pings
  if (isVeryShort) {
    const r = Math.random();
    if (r < 0.45) return randMs(1_500, 6_000);   // fast (45%)
    if (r < 0.80) return randMs(6_000, 13_000);  // medium (35%)
    return randMs(13_000, MAX);                   // slow (20%)
  }

  // Regular casual message
  const r = Math.random();
  if (r < 0.15) return randMs(2_000, 5_000);    // fast (15%)
  if (r < 0.50) return randMs(5_000, 11_000);   // medium (35%)
  if (r < 0.80) return randMs(11_000, 17_000);  // slow (30%)
  return randMs(17_000, MAX);                   // very slow (20%)
}

/* ─── POST /api/chat ─────────────────────────────────────── */

router.post("/chat", requireAuth, async (req: AuthRequest, res: Response) => {
  const { persona_id, message } = req.body;

  if (!persona_id || !message?.trim()) {
    res.status(400).json({ error: "persona_id ve message gerekli" });
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

  if (!persona.analysis) {
    res.status(400).json({ error: "Bu profil henüz analiz edilmemiş" });
    return;
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("subscription_tier")
    .eq("id", req.user!.id)
    .single();

  const tier = (profile?.subscription_tier as "free" | "basic" | "full") ?? "free";
  const { allowed, reason } = canSendMessage(tier, persona.message_count_used);

  if (!allowed) {
    res.status(403).json({ error: reason, upgrade_required: true, limit_reached: true });
    return;
  }

  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("persona_id", persona_id)
    .eq("user_id", req.user!.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const conversationHistory = (history ?? []).reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const historyLength = conversationHistory.length;
  const limits = getLimits(tier);
  const systemPrompt = buildChatSystemPrompt(
    persona.target_name,
    persona.requester_name,
    persona.analysis as PersonaAnalysis
  );

  const typingDelay = calculateTypingDelay(message, historyLength);
  const holdDelay = getContextualDelay(historyLength, message);

  await supabase.from("messages").insert({
    persona_id,
    user_id: req.user!.id,
    role: "user",
    content: message.trim(),
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      // client disconnected
    }
  };

  try {
    send({ type: "typing_delay", delay: typingDelay });

    const aiStream = await openai.chat.completions.create({
      model: limits.aiModel,
      max_completion_tokens: 512,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: message.trim() },
      ],
    });

    let fullResponse = "";
    const newCount = persona.message_count_used + 1;

    if (holdDelay === 0) {
      /* ── IMMEDIATE mode ──────────────────────────────────── */
      for await (const chunk of aiStream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          send({ type: "chunk", content });
        }
      }

      const parts = splitIntoMessages(fullResponse);

      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          const between = 350 + Math.random() * 500;
          send({ type: "typing_delay", delay: between });
          await new Promise((r) => setTimeout(r, between));
        }
        send({ type: "message", content: parts[i] });
      }

      send({ type: "done", message_count_used: newCount });

    } else {
      /* ── SCHEDULED mode ──────────────────────────────────── */
      for await (const chunk of aiStream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) fullResponse += content;
      }

      const parts = splitIntoMessages(fullResponse);
      const typingMs = 2000 + Math.random() * 1500;

      send({
        type: "scheduled",
        hold_ms: holdDelay,
        typing_ms: Math.round(typingMs),
        parts: parts.length > 0 ? parts : [fullResponse.trim() || "..."],
        message_count_used: newCount,
      });
    }

    // Save AI response to DB in background (non-blocking)
    void (async () => {
      try {
        const parts = splitIntoMessages(fullResponse);
        const toSave = parts.length > 0 ? parts : [fullResponse.trim() || "..."];
        await Promise.all([
          ...toSave.map((part) =>
            supabase.from("messages").insert({
              persona_id,
              user_id: req.user!.id,
              role: "assistant",
              content: part,
            })
          ),
          supabase
            .from("personas")
            .update({ message_count_used: newCount, updated_at: new Date().toISOString() })
            .eq("id", persona_id),
        ]);
      } catch (e) {
        console.error("DB save failed after chat:", e);
      }
    })();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI hatası";
    send({ type: "error", message: msg });
  } finally {
    res.end();
  }
});

/* ─── POST /api/chat/start — Persona sends the opening message ─ */

router.post("/chat/start", requireAuth, async (req: AuthRequest, res: Response) => {
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

  if (!persona.analysis) {
    res.status(400).json({ error: "Analiz bekleniyor" });
    return;
  }

  // Check there are genuinely no messages yet
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("persona_id", persona_id)
    .eq("user_id", req.user!.id);

  if ((count ?? 0) > 0) {
    res.status(409).json({ error: "Sohbet zaten başlamış" });
    return;
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("subscription_tier")
    .eq("id", req.user!.id)
    .single();

  const tier = (profile?.subscription_tier as "free" | "basic" | "full") ?? "free";
  const limits = getLimits(tier);

  const analysis = persona.analysis as PersonaAnalysis;
  const openings = analysis.signature_openings ?? [];
  const openingsHint =
    openings.length > 0
      ? `Tipik açılış tarzın: "${openings.slice(0, 3).join('", "')}"`
      : "";

  const starterSystemPrompt = `Sen ${persona.target_name} adlı kişisin. ${persona.requester_name} ile WhatsApp'ta konuşuyorsun.
${buildChatSystemPrompt(persona.target_name, persona.requester_name, analysis)}

GÖREV: Sohbete SEN başlatıyorsun. İlk mesajı sen atıyorsun.
${openingsHint}
Kısa, doğal, sana özgü bir açılış at. Yapay görünmesin. Sanki WhatsApp'ı açıp mesaj atıyormuşsun gibi.
Sadece mesajı yaz, başka bir şey yazma.`;

  try {
    const completion = await openai.chat.completions.create({
      model: limits.aiModel,
      max_completion_tokens: 80,
      messages: [
        { role: "system", content: starterSystemPrompt },
        { role: "user", content: "__START__" },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "selam";
    const parts = splitIntoMessages(content);
    const toSave = parts.length > 0 ? parts : [content];

    await Promise.all([
      ...toSave.map((part) =>
        supabase.from("messages").insert({
          persona_id,
          user_id: req.user!.id,
          role: "assistant",
          content: part,
        })
      ),
      supabase
        .from("personas")
        .update({ message_count_used: persona.message_count_used + 1, updated_at: new Date().toISOString() })
        .eq("id", persona_id),
    ]);

    res.json({ messages: toSave.map((part) => ({ role: "assistant", content: part })) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI hatası";
    res.status(500).json({ error: msg });
  }
});

/* ─── POST /api/chat/idle — Persona re-engages after silence ─── */

router.post("/chat/idle", requireAuth, async (req: AuthRequest, res: Response) => {
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

  if (!persona.analysis) {
    res.status(400).json({ error: "Analiz bekleniyor" });
    return;
  }

  // Verify there are existing messages (don't re-engage an empty chat)
  const { data: lastMessages } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("persona_id", persona_id)
    .eq("user_id", req.user!.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!lastMessages || lastMessages.length === 0) {
    res.status(409).json({ error: "Sohbet başlamamış" });
    return;
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("subscription_tier")
    .eq("id", req.user!.id)
    .single();

  const tier = (profile?.subscription_tier as "free" | "basic" | "full") ?? "free";
  const limits = getLimits(tier);
  const analysis = persona.analysis as PersonaAnalysis;

  const recentContext = [...lastMessages].reverse().map((m) =>
    `${m.role === "assistant" ? persona.target_name : persona.requester_name}: ${m.content}`
  ).join("\n");

  const idleSystemPrompt = `${buildChatSystemPrompt(persona.target_name, persona.requester_name, analysis)}

GÖREV: Konuşmada bir süre sessizlik var. Sen ${persona.target_name} olarak yeniden bir şey atıyorsun.
Bu mesaj kısa ve doğal olsun. Sanki "acaba ne yapıyor" diye WhatsApp'ı açmışsın gibi.
Örnekler: "napıyosun", "ya", "noldun", "uyudun mu", "ne oldu", "kayboldun" — ama bunları değil, sana özgün olanı yaz.
Son mesajlar:
${recentContext}
Sadece mesajı yaz.`;

  try {
    const completion = await openai.chat.completions.create({
      model: limits.aiModel,
      max_completion_tokens: 40,
      messages: [
        { role: "system", content: idleSystemPrompt },
        { role: "user", content: "__IDLE__" },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "ya";

    await Promise.all([
      supabase.from("messages").insert({
        persona_id,
        user_id: req.user!.id,
        role: "assistant",
        content,
      }),
      supabase
        .from("personas")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", persona_id),
    ]);

    res.json({ message: { role: "assistant", content } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI hatası";
    res.status(500).json({ error: msg });
  }
});

export default router;
