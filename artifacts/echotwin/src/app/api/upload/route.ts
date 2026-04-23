import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseWhatsAppChat } from "@/lib/parser";
import { extractChatUpload } from "@/lib/media/archive";
import { normalizeMediaFileName } from "@/lib/media/files";
import { MAX_AUDIO_BYTES, MAX_CHAT_UPLOAD_BYTES, MAX_IMAGE_BYTES } from "@/lib/media/limits";
import { buildMediaMemoryItems } from "@/lib/media/memory";
import { CHAT_MEDIA_BUCKET, createChatMediaStoragePath } from "@/lib/media/storage";

export const runtime = "nodejs";

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
    const file = formData.get("file");

    if (!isUploadedFile(file)) {
      return NextResponse.json({ error: "Dosya bulunamadi" }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".txt") && !lowerName.endsWith(".zip")) {
      return NextResponse.json(
        { error: "Yalnizca .txt veya .zip dosyasi kabul edilir" },
        { status: 400 }
      );
    }

    if (file.size > MAX_CHAT_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Dosya boyutu 50 MB'dan buyuk olamaz" },
        { status: 400 }
      );
    }

    const extraction = await extractChatUpload(file);
    const parsed = parseWhatsAppChat(extraction.rawText);
    const parseWarnings = [...extraction.warnings];
    const initialParsedData = createParsedData({
      fileName: file.name,
      extraction,
      parsed,
      uploadedMediaCount: 0,
      mediaMemory: [],
      parseWarnings,
    });

    const { data: exportRecord, error: exportError } = await supabase
      .from("chat_exports")
      .insert({
        user_id: user.id,
        file_name: file.name,
        participants: parsed.participants,
        message_count: parsed.total_messages,
        parsed_data: initialParsedData,
      })
      .select()
      .single();

    if (exportError || !exportRecord) {
      console.error("[upload] export save failed", exportError);
      return NextResponse.json(
        { error: "Sohbet kaydedilemedi. Lutfen tekrar dene." },
        { status: 500 }
      );
    }

    const uploadedMediaUrls = await uploadReferencedZipMedia({
      supabase,
      userId: user.id,
      exportId: exportRecord.id,
      mediaFiles: extraction.mediaFiles,
      referencedNames: new Set(
        parsed.media_items
          .map((item) => (item.file_name ? normalizeMediaFileName(item.file_name) : null))
          .filter((item): item is string => item !== null)
      ),
      warnings: parseWarnings,
    });
    const mediaMemory = buildMediaMemoryItems(parsed, uploadedMediaUrls);

    await supabase
      .from("chat_exports")
      .update({
        parsed_data: createParsedData({
          fileName: file.name,
          extraction,
          parsed,
          uploadedMediaCount: uploadedMediaUrls.size,
          mediaMemory,
          parseWarnings,
        }),
      })
      .eq("id", exportRecord.id)
      .eq("user_id", user.id);

    const messagesToStore = parsed.messages
      .filter((message) => !message.is_media)
      .map((message) => ({
        sender: message.sender,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
        conversation_turn_index: message.conversation_turn_index,
        is_reply: message.is_reply,
        message_length: message.message_length,
        has_question: message.has_question,
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
      media_count: parsed.media_count,
      uploaded_media_count: uploadedMediaUrls.size,
      source_type: extraction.sourceType,
      warnings: parseWarnings,
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Yukleme hatasi";
    const response = toUploadErrorResponse(rawMessage);
    console.error("[upload] failed", {
      message: rawMessage,
    });
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

type UploadSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type ChatUploadExtraction = Awaited<ReturnType<typeof extractChatUpload>>;
type ParsedChatResult = ReturnType<typeof parseWhatsAppChat>;

async function uploadReferencedZipMedia(params: {
  supabase: UploadSupabaseClient;
  userId: string;
  exportId: string;
  mediaFiles: ChatUploadExtraction["mediaFiles"];
  referencedNames: Set<string>;
  warnings: string[];
}): Promise<Map<string, string>> {
  const uploaded = new Map<string, string>();
  const candidates = params.mediaFiles.filter(
    (file) => params.referencedNames.size === 0 || params.referencedNames.has(file.normalizedName)
  );

  for (const mediaFile of candidates.slice(0, 150)) {
    try {
      const bytes = await mediaFile.readBytes();
      const limit =
        mediaFile.mediaType === "audio"
          ? MAX_AUDIO_BYTES
          : mediaFile.mediaType === "image"
          ? MAX_IMAGE_BYTES
          : MAX_CHAT_UPLOAD_BYTES;

      if (bytes.byteLength > limit) {
        params.warnings.push(`${mediaFile.fileName} boyut limiti nedeniyle atlandi`);
        continue;
      }

      const storagePath = createChatMediaStoragePath({
        userId: params.userId,
        scopeId: params.exportId,
        fileName: mediaFile.fileName,
      });
      const { error: uploadError } = await params.supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .upload(storagePath, Buffer.from(bytes), {
          upsert: false,
          contentType: mediaFile.contentType,
        });

      if (uploadError) {
        params.warnings.push(`${mediaFile.fileName} medyasi yuklenemedi`);
        continue;
      }

      const { data: urlData } = params.supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .getPublicUrl(storagePath);
      uploaded.set(mediaFile.normalizedName, urlData.publicUrl);
    } catch (error) {
      params.warnings.push(`${mediaFile.fileName} medyasi okunamadi`);
      console.warn("[upload] media skipped", {
        file_name: mediaFile.fileName,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return uploaded;
}

function createParsedData(params: {
  fileName: string;
  extraction: ChatUploadExtraction;
  parsed: ParsedChatResult;
  uploadedMediaCount: number;
  mediaMemory: ReturnType<typeof buildMediaMemoryItems>;
  parseWarnings: string[];
}): Record<string, unknown> {
  return {
    upload: {
      source_type: params.extraction.sourceType,
      original_file_name: params.fileName,
      chat_file_name: params.extraction.chatFileName,
      media_count: params.parsed.media_count,
      zip_media_count: params.extraction.mediaFiles.length,
      uploaded_media_count: params.uploadedMediaCount,
    },
    date_range: {
      start: params.parsed.date_range.start.toISOString(),
      end: params.parsed.date_range.end.toISOString(),
    },
    stats: params.parsed.stats,
    media_memory: params.mediaMemory,
    parse_warnings: params.parseWarnings,
  };
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value !== "string" && value !== null;
}

function toUploadErrorResponse(message: string): { message: string; status: number } {
  if (message.includes("Zip icinde sohbet .txt dosyasi bulunamadi")) {
    return {
      message:
        "Zip içinde sohbet .txt dosyası bulunamadı. Medyasız zip yükleyeceksen zip içinde WhatsApp sohbet .txt dosyası olmalı.",
      status: 400,
    };
  }

  if (message.includes("Sohbet dosyası parse edilemedi")) {
    return { message, status: 400 };
  }

  return {
    message: "Sohbet yüklenemedi. Lütfen dosyayı kontrol edip tekrar dene.",
    status: 500,
  };
}
