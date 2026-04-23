import { MAX_AUDIO_BYTES } from "@/lib/media/limits";
import { generateGeminiAudio } from "@/lib/ai/gemini";
import { AiServiceError } from "@/lib/ai/types";

export const TRANSCRIBE_MIN_AUDIO_BYTES = 1024;
export const TRANSCRIBE_MAX_AUDIO_BYTES = MAX_AUDIO_BYTES;

export type TranscriptionResult = {
  text: string;
  model: string;
  provider: "gemini";
};

export async function transcribeAudio(file: File): Promise<TranscriptionResult> {
  validateAudioFile(file);

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const raw = await generateGeminiAudio({
    prompt:
      "Bu ses kaydindaki konusmayi asagidaki kurallarla yaziya cevir. Sadece duz metin dondur, aciklama ekleme. Konusma Turkce ise Turkce yaz.",
    audio: {
      mimeType: file.type || "audio/webm",
      base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
    },
    temperature: 0.1,
    maxOutputTokens: 1024,
  });

  const text = normalizeTranscript(raw);
  if (!text) {
    throw new AiServiceError({
      code: "ai_invalid_response",
      message: "Gemini returned empty transcription",
      userMessage: "Ses mesajı okunamadı, tekrar dene",
      status: 422,
      retryable: true,
    });
  }

  return {
    text,
    model,
    provider: "gemini",
  };
}

function validateAudioFile(file: File) {
  if (file.size < TRANSCRIBE_MIN_AUDIO_BYTES) {
    throw new AiServiceError({
      code: "ai_invalid_response",
      message: `Audio file is too small: ${file.size} bytes`,
      userMessage: "Ses mesajı okunamadı, tekrar dene",
      status: 400,
    });
  }

  if (file.size > TRANSCRIBE_MAX_AUDIO_BYTES) {
    throw new AiServiceError({
      code: "ai_invalid_response",
      message: `Audio file is too large: ${file.size} bytes`,
      userMessage: "Ses kaydı çok uzun, daha kısa tekrar dene",
      status: 413,
    });
  }

  if (file.type && !file.type.startsWith("audio/")) {
    throw new AiServiceError({
      code: "ai_invalid_response",
      message: `Unsupported upload type: ${file.type}`,
      userMessage: "Ses mesajı okunamadı, tekrar dene",
      status: 400,
    });
  }
}

function normalizeTranscript(text: string): string {
  const trimmed = text
    .replace(/^```(?:text)?/i, "")
    .replace(/```$/i, "")
    .trim();
  return trimmed;
}
