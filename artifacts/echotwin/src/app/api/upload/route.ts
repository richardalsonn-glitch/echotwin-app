import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseWhatsAppChat } from "@/lib/parser";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
    }

    if (!file.name.endsWith(".txt")) {
      return NextResponse.json(
        { error: "Yalnızca .txt dosyası kabul edilir" },
        { status: 400 }
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Dosya boyutu 50MB'dan büyük olamaz" },
        { status: 400 }
      );
    }

    const rawText = await file.text();
    const parsed = parseWhatsAppChat(rawText);

    // Save to database
    const { data: exportRecord, error: exportError } = await supabase
      .from("chat_exports")
      .insert({
        user_id: user.id,
        file_name: file.name,
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
      console.error("Export save error:", exportError);
      return NextResponse.json(
        { error: "Sohbet kaydedilemedi: " + exportError.message },
        { status: 500 }
      );
    }

    // Cache messages in DB (store as jsonb for analysis)
    const messagesToStore = parsed.messages
      .filter((m) => !m.is_media)
      .slice(0, 2000) // Max 2000 messages stored
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
      user_id: user.id,
      messages: messagesToStore,
    });

    return NextResponse.json({
      export_id: exportRecord.id,
      participants: parsed.participants,
      total_messages: parsed.total_messages,
      date_range: {
        start: parsed.date_range.start.toISOString(),
        end: parsed.date_range.end.toISOString(),
      },
      stats: parsed.stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
