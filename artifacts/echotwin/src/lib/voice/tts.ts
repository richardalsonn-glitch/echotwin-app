import OpenAI from "openai";
import { AiServiceError } from "@/lib/ai/types";

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

export type VoiceTtsRequest = {
  text: string;
  instructions?: string;
};

export type VoiceTtsResult = {
  audio: ArrayBuffer;
  contentType: "audio/mpeg";
  extension: "mp3";
  provider: "openai";
  model: string;
  voice: string;
};

export async function synthesizeSpeech(
  request: VoiceTtsRequest
): Promise<VoiceTtsResult> {
  const input = request.text.trim();

  if (!input) {
    throw new AiServiceError({
      code: "ai_invalid_response",
      message: "Voice TTS input is empty",
      userMessage: "Sesli mesaj hazirlanamadi",
      status: 400,
    });
  }

  const model = getVoiceTtsModel();
  const voice = getVoiceTtsVoice();

  try {
    const client = createVoiceClient();
    const response = await client.audio.speech.create({
      model,
      voice,
      input: input.slice(0, 4096),
      response_format: "mp3",
      ...(model === "gpt-4o-mini-tts" && request.instructions
        ? { instructions: request.instructions }
        : {}),
    });

    const audio = await response.arrayBuffer();

    if (audio.byteLength < 512) {
      throw new AiServiceError({
        code: "ai_invalid_response",
        message: `Voice TTS returned a tiny audio payload: ${audio.byteLength} bytes`,
        userMessage: "Sesli mesaj hazirlanamadi",
        status: 502,
      });
    }

    return {
      audio,
      contentType: "audio/mpeg",
      extension: "mp3",
      provider: "openai",
      model,
      voice,
    };
  } catch (error) {
    throw normalizeTtsError(error);
  }
}

function createVoiceClient(): OpenAI {
  const apiKey =
    getOptionalEnv("AI_VOICE_OPENAI_API_KEY") ??
    getOptionalEnv("AI_INTEGRATIONS_OPENAI_API_KEY") ??
    getOptionalEnv("AI_TRANSCRIBE_OPENAI_API_KEY");

  if (!apiKey) {
    throw new AiServiceError({
      code: "ai_config_missing",
      message: "OpenAI voice API key is not configured",
      userMessage: "Sesli mesaj servisi ayarli degil",
      status: 500,
    });
  }

  const baseURL =
    getOptionalEnv("AI_VOICE_OPENAI_BASE_URL") ??
    getOptionalEnv("AI_INTEGRATIONS_OPENAI_BASE_URL") ??
    "https://api.openai.com/v1";

  return new OpenAI({ apiKey, baseURL });
}

function getVoiceTtsModel(): string {
  return getOptionalEnv("AI_VOICE_OPENAI_TTS_MODEL") ?? "gpt-4o-mini-tts";
}

function getVoiceTtsVoice(): string {
  return getOptionalEnv("AI_VOICE_OPENAI_TTS_VOICE") ?? "verse";
}

function normalizeTtsError(error: unknown): AiServiceError {
  if (error instanceof AiServiceError) return error;

  const err = getProviderErrorShape(error);
  const status = err.status ?? 500;
  const rawCode = err.error?.code ?? err.code ?? err.error?.type ?? err.type ?? "tts_error";
  const rawMessage =
    err.error?.message ??
    err.message ??
    (error instanceof Error ? error.message : "Unknown voice TTS error");

  if (status === 401 || status === 403) {
    return new AiServiceError({
      code: "ai_auth_failed",
      message: `${rawCode}: ${rawMessage}`,
      userMessage: "Sesli mesaj servisi yetkilendirilemedi",
      status: 500,
      cause: error,
    });
  }

  if (status === 429) {
    return new AiServiceError({
      code: "ai_rate_limited",
      message: `${rawCode}: ${rawMessage}`,
      userMessage: "Sesli mesaj servisi yogun, sonra tekrar dene",
      status,
      retryable: true,
      cause: error,
    });
  }

  return new AiServiceError({
    code: status >= 500 ? "ai_provider_unavailable" : "ai_error",
    message: `${rawCode}: ${rawMessage}`,
    userMessage: "Sesli mesaj hazirlanamadi",
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
