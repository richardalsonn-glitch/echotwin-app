import { Router } from "express";
import multer from "multer";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { createSupabaseClient } from "../lib/supabase.js";
import { parseWhatsAppChat } from "../lib/parser/whatsapp.js";
import type { Response } from "express";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post("/upload", requireAuth, upload.single("file"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Dosya bulunamadı" });
      return;
    }

    if (!req.file.originalname.endsWith(".txt")) {
      res.status(400).json({ error: "Yalnızca .txt dosyası kabul edilir" });
      return;
    }

    const rawText = req.file.buffer.toString("utf-8");
    let parsed;
    try {
      parsed = parseWhatsAppChat(rawText);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : "Parse hatası";
      res.status(400).json({ error: msg });
      return;
    }

    const supabase = createSupabaseClient(req, res);

    const { data: exportRecord, error: exportError } = await supabase
      .from("chat_exports")
      .insert({
        user_id: req.user!.id,
        file_name: req.file.originalname,
        // Participants already sorted by message count (most active first)
        participants: parsed.participants,
        message_count: parsed.total_messages,
        parsed_data: {
          date_range: {
            start: parsed.date_range.start.toISOString(),
            end: parsed.date_range.end.toISOString(),
          },
          stats: parsed.stats,
        },
      })
      .select()
      .single();

    if (exportError) {
      res.status(500).json({ error: "Sohbet kaydedilemedi: " + exportError.message });
      return;
    }

    // Store up to 3000 messages for analysis (exclude media, include short msgs for context)
    const messagesToStore = parsed.messages
      .filter((m) => !m.is_media)
      .slice(0, 3000)
      .map((m) => ({
        sender: m.sender,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
        conversation_turn_index: m.conversation_turn_index,
        is_reply: m.is_reply,
        message_length: m.message_length,
        has_question: m.has_question,
      }));

    await supabase.from("chat_messages_cache").insert({
      export_id: exportRecord.id,
      user_id: req.user!.id,
      messages: messagesToStore,
    });

    res.json({
      export_id: exportRecord.id,
      // Participants sorted by message count
      participants: parsed.participants,
      total_messages: parsed.total_messages,
      date_range: {
        start: parsed.date_range.start.toISOString(),
        end: parsed.date_range.end.toISOString(),
      },
      // Stats includes message_count per participant
      stats: parsed.stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    res.status(500).json({ error: message });
  }
});

export default router;
