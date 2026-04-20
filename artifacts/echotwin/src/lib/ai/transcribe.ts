import OpenAI from "openai";
import { AiServiceError } from "./types";

export const TRANSCRIBE_MIN_AUDIO_BYTES = 1024;
export const TRANSCRIBE_MAX_AUDIO_BYTES = 4 * 1024 * 1024;

type ProviderErrorShape = {
  status?: number;
  code?: string | null;
  type?: string | null;
  message?: string;
  error?: {
    code?: string | null;
    type?: string | null;
    message?: string;
  };
};

export type TranscriptionResult = {
  text: string;
  model: string;
  provider: "openai";
};

export async function transcribeAudio(file: File): Promise<TranscriptionResult> {
  validateAudioFile(file);

  const model = getTranscriptionModel();

  try {
    const client = createTranscriptionClient();
    const transcription = await client.audio.transcriptions.create({
      file,
      model,
      language: "tr",
      response_format: "json",
    });

    const text = transcription.text.trim();
    if (!text) {
      throw new AiServiceError({
        code: "ai_invalid_response",
        message: "Transcription returned empty text",
        userMessage: "Ses mesajı okunamadı, tekrar dene",
        status: 422,
      });
    }

    return {
      text,
      model,
      provider: "openai",
    };
  } catch (error) {
    throw normalizeTranscriptionError(error);
  }
}

function createTranscriptionClient(): OpenAI {
  const apiKey =
    getOptionalEnv("AI_TRANSCRIBE_OPENAI_API_KEY") ??
    getOptionalEnv("AI_INTEGRATIONS_OPENAI_API_KEY");

  if (!apiKey) {
    throw new AiServiceError({
      code: "ai_config_missing",
      message: "OpenAI transcription API key is not configured",
      userMessage: "Ses yazıya çevirme servisi ayarlı değil",
      status: 500,
    });
  }

  const baseURL =
    getOptionalEnv("AI_TRANSCRIBE_OPENAI_BASE_URL") ??
    getOptionalEnv("AI_INTEGRATIONS_OPENAI_BASE_URL") ??
    "https://api.openai.com/v1";

  return new OpenAI({ apiKey, baseURL });
}

function getTranscriptionModel(): string {
  return getOptionalEnv("AI_TRANSCRIBE_OPENAI_MODEL") ?? "gpt-4o-mini-transcribe";
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

function normalizeTranscriptionError(error: unknown): AiServiceError {
  if (error instanceof AiServiceError) return error;

  const err = getProviderErrorShape(error);
  const status = err.status ?? 500;
  const rawCode = err.error?.code ?? err.code ?? err.error?.type ?? err.type ?? "stt_error";
  const rawMessage =
    err.error?.message ??
    err.message ??
    (error instanceof Error ? error.message : "Unknown transcription error");

  if (status === 401 || status === 403) {
    return new AiServiceError({
      code: "ai_auth_failed",
      message: `${rawCode}: ${rawMessage}`,
      userMessage: "Ses yazıya çevirme servisi yetkilendirilemedi",
      status: 500,
      cause: error,
    });
  }

  if (status === 429) {
    return new AiServiceError({
      code: "ai_rate_limited",
      message: `${rawCode}: ${rawMessage}`,
      userMessage: "Ses yazıya çevirme servisi yoğun, biraz sonra tekrar dene",
      status,
      retryable: true,
      cause: error,
    });
  }

  return new AiServiceError({
    code: status >= 500 ? "ai_provider_unavailable" : "ai_error",
    message: `${rawCode}: ${rawMessage}`,
    userMessage: "Ses mesajı okunamadı, tekrar dene",
    status,
    retryable: status >= 500,
    cause: error,
  });
}

function getProviderErrorShape(error: unknown): ProviderErrorShape {
  return typeof error === "object" && error !== null ? (error as ProviderErrorShape) : {};
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}
