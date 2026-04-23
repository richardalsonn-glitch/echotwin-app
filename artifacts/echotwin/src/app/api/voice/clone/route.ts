import { NextRequest, NextResponse } from "next/server";
import { createVoiceClone } from "@/lib/voice/elevenlabs";
import { getAiErrorResponse } from "@/lib/ai/errors";
import { validateVoiceSampleFile } from "@/lib/voice/profile";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const nameValue = formData.get("name");
    const name =
      typeof nameValue === "string" && nameValue.trim() ? nameValue.trim() : "BendekiSen Voice";

    if (!isUploadedFile(audio)) {
      return NextResponse.json({ error: "audio dosyasi gerekli" }, { status: 400 });
    }

    const validation = validateVoiceSampleFile(audio);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.userMessage }, { status: validation.status });
    }

    const clone = await createVoiceClone({
      name,
      audioSample: audio,
      description: "BendekiSen ElevenLabs Creator voice clone",
    });

    return NextResponse.json({ voice: clone });
  } catch (error) {
    const aiError = getAiErrorResponse(error);
    return NextResponse.json(
      { error: aiError.message, code: aiError.code },
      { status: aiError.status }
    );
  }
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value !== "string" && value !== null;
}
