import { NextRequest, NextResponse } from "next/server";
import { getAiErrorResponse } from "@/lib/ai/errors";
import { isAiServiceError } from "@/lib/ai/types";
import { TRANSCRIBE_MAX_AUDIO_BYTES, TRANSCRIBE_MIN_AUDIO_BYTES, transcribeAudio } from "@/lib/ai/transcribe";
import { createClient } from "@/lib/supabase/server";

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
    const audio = formData.get("audio");

    if (!isUploadedFile(audio)) {
      return NextResponse.json(
        { error: "Ses mesajı okunamadı, tekrar dene" },
        { status: 400 }
      );
    }

    if (audio.size < TRANSCRIBE_MIN_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Ses mesajı okunamadı, tekrar dene" },
        { status: 400 }
      );
    }

    if (audio.size > TRANSCRIBE_MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Ses kaydı çok uzun, daha kısa tekrar dene" },
        { status: 413 }
      );
    }

    if (audio.type && !audio.type.startsWith("audio/")) {
      console.warn("[transcribe] rejected non-audio upload", {
        type: audio.type,
        size: audio.size,
      });
      return NextResponse.json(
        { error: "Ses mesajı okunamadı, tekrar dene" },
        { status: 400 }
      );
    }

    const result = await transcribeAudio(audio);

    return NextResponse.json({
      text: result.text,
      model: result.model,
      provider: result.provider,
    });
  } catch (error) {
    const aiError = getAiErrorResponse(error);
    console.error("[transcribe] failed", {
      code: aiError.code,
      status: aiError.status,
      upstreamStatusCode: aiError.upstreamStatusCode,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        error: isAiServiceError(error)
          ? aiError.message
          : "Ses mesajı okunamadı, tekrar dene",
        code: aiError.code,
      },
      { status: aiError.status }
    );
  }
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value !== "string" && value !== null;
}
