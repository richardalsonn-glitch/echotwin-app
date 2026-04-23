import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/voice/elevenlabs";
import { getAiErrorResponse } from "@/lib/ai/errors";

export const runtime = "nodejs";

type SpeakBody = {
  text?: unknown;
  voice_id?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as SpeakBody;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const voiceId =
      typeof body.voice_id === "string" && body.voice_id.trim()
        ? body.voice_id.trim()
        : process.env.ELEVENLABS_DEFAULT_VOICE_ID?.trim() ?? "";

    if (!text || !voiceId) {
      return NextResponse.json(
        { error: "text ve voice_id gerekli" },
        { status: 400 }
      );
    }

    const speech = await synthesizeSpeech({ text, voiceId });
    return new NextResponse(speech.audio, {
      headers: {
        "Content-Type": speech.contentType,
        "X-Voice-Provider": speech.provider,
        "X-Voice-Model": speech.model,
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
