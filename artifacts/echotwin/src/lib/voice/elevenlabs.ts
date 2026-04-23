import { AiServiceError } from "@/lib/ai/types";

export type ElevenLabsVoiceCloneResult = {
  provider: "elevenlabs";
  voiceId: string;
  name: string;
};

export type ElevenLabsSpeechResult = {
  audio: ArrayBuffer;
  contentType: "audio/mpeg";
  extension: "mp3";
  provider: "elevenlabs";
  model: string;
  voice: string;
};

const ELEVENLABS_API_BASE_URL = "https://api.elevenlabs.io/v1";
const DEFAULT_TTS_MODEL = "eleven_multilingual_v2";

export async function createVoiceClone(params: {
  name: string;
  audioSample: File;
  description?: string;
}): Promise<ElevenLabsVoiceCloneResult> {
  const formData = new FormData();
  formData.append("name", params.name);
  formData.append("files", params.audioSample, params.audioSample.name || "voice-sample.mp3");
  if (params.description) formData.append("description", params.description);

  const response = await elevenLabsFetch("/voices/add", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => ({}))) as { voice_id?: unknown };
  const voiceId = typeof payload.voice_id === "string" ? payload.voice_id : "";

  if (!voiceId) {
    throw new AiServiceError({
      code: "ai_invalid_response",
      message: "ElevenLabs clone response did not include voice_id",
      userMessage: "Ses profili hazirlanamadi",
      status: 502,
    });
  }

  return {
    provider: "elevenlabs",
    voiceId,
    name: params.name,
  };
}

export async function synthesizeSpeech(params: {
  text: string;
  voiceId: string;
}): Promise<ElevenLabsSpeechResult> {
  const text = params.text.trim();
  if (!text) {
    throw new AiServiceError({
      code: "ai_invalid_response",
      message: "ElevenLabs TTS text is empty",
      userMessage: "Sesli mesaj hazirlanamadi",
      status: 400,
    });
  }

  const model = process.env.ELEVENLABS_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL;
  const response = await elevenLabsFetch(`/text-to-speech/${encodeURIComponent(params.voiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text.slice(0, 4096),
      model_id: model,
      output_format: "mp3_44100_128",
    }),
  });

  const audio = await response.arrayBuffer();
  if (audio.byteLength < 512) {
    throw new AiServiceError({
      code: "ai_invalid_response",
      message: `ElevenLabs returned tiny audio payload: ${audio.byteLength}`,
      userMessage: "Sesli mesaj hazirlanamadi",
      status: 502,
    });
  }

  return {
    audio,
    contentType: "audio/mpeg",
    extension: "mp3",
    provider: "elevenlabs",
    model,
    voice: params.voiceId,
  };
}

async function elevenLabsFetch(path: string, init: RequestInit): Promise<Response> {
  const apiKey = getElevenLabsApiKey();
  const response = await fetch(`${ELEVENLABS_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "xi-api-key": apiKey,
      ...(init.headers ?? {}),
    },
  });

  if (response.ok) return response;

  const message = await response.text().catch(() => response.statusText);
  throw normalizeElevenLabsError(response.status, message);
}

function getElevenLabsApiKey(): string {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new AiServiceError({
      code: "ai_config_missing",
      message: "ELEVENLABS_API_KEY is not configured",
      userMessage: "ElevenLabs API anahtari eksik",
      status: 500,
    });
  }
  return apiKey;
}

function normalizeElevenLabsError(status: number, message: string): AiServiceError {
  if (status === 401 || status === 403) {
    return new AiServiceError({
      code: "ai_auth_failed",
      message,
      userMessage: "ElevenLabs servisi yetkilendirilemedi",
      status: 500,
    });
  }
  if (status === 429) {
    return new AiServiceError({
      code: "ai_rate_limited",
      message,
      userMessage: "ElevenLabs su anda yogun, biraz sonra tekrar dene",
      status,
      retryable: true,
    });
  }
  return new AiServiceError({
    code: status >= 500 ? "ai_provider_unavailable" : "ai_error",
    message,
    userMessage: "ElevenLabs islemi tamamlanamadi",
    status,
    retryable: status >= 500,
  });
}
