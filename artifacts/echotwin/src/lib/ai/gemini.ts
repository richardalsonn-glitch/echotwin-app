import { AiServiceError } from "@/lib/ai/types";

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiContent = {
  role?: "user" | "model";
  parts: GeminiPart[];
};

type GeminiGenerateRequest = {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: "application/json" | "text/plain";
    responseSchema?: Record<string, unknown>;
  };
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

export type GeminiTextRequest = {
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
  responseSchema?: Record<string, unknown>;
};

export type GeminiImageRequest = Omit<GeminiTextRequest, "prompt"> & {
  prompt: string;
  image: {
    mimeType: string;
    base64: string;
  };
};

export type GeminiAudioRequest = Omit<GeminiTextRequest, "prompt"> & {
  prompt: string;
  audio: {
    mimeType: string;
    base64: string;
  };
};

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export async function generateGeminiText(request: GeminiTextRequest): Promise<string> {
  return generateGeminiContent({
    contents: [{ role: "user", parts: [{ text: request.prompt }] }],
    request,
  });
}

export async function generateGeminiImage(request: GeminiImageRequest): Promise<string> {
  return generateGeminiContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: request.prompt },
          {
            inlineData: {
              mimeType: request.image.mimeType,
              data: request.image.base64,
            },
          },
        ],
      },
    ],
    request,
  });
}

export async function generateGeminiAudio(request: GeminiAudioRequest): Promise<string> {
  return generateGeminiContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: request.prompt },
          {
            inlineData: {
              mimeType: request.audio.mimeType,
              data: request.audio.base64,
            },
          },
        ],
      },
    ],
    request,
  });
}

async function generateGeminiContent(params: {
  contents: GeminiContent[];
  request: GeminiTextRequest;
}): Promise<string> {
  const apiKey = getGeminiApiKey();
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const url = `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body: GeminiGenerateRequest = {
    contents: params.contents,
    ...(params.request.systemInstruction
      ? { systemInstruction: { parts: [{ text: params.request.systemInstruction }] } }
      : {}),
    generationConfig: {
      temperature: params.request.temperature ?? 0.2,
      maxOutputTokens: params.request.maxOutputTokens ?? 2048,
      responseMimeType: params.request.json ? "application/json" : "text/plain",
      ...(params.request.responseSchema ? { responseSchema: params.request.responseSchema } : {}),
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as GeminiGenerateResponse;

    if (!response.ok) {
      throw normalizeGeminiError(response.status, payload.error?.message ?? response.statusText);
    }

    const text =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

    if (!text) {
      throw new AiServiceError({
        code: "ai_invalid_response",
        message: "Gemini returned empty content",
        userMessage: "AI yaniti islenemedi",
        status: 502,
        retryable: true,
      });
    }

    return text;
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AiServiceError({
        code: "ai_timeout",
        message: "Gemini request timed out",
        userMessage: "AI servisi zaman asimina ugradi",
        status: 504,
        retryable: true,
        cause: error,
      });
    }
    throw new AiServiceError({
      code: "ai_provider_unavailable",
      message: error instanceof Error ? error.message : "Gemini request failed",
      userMessage: "AI servisi su anda yanit veremiyor",
      status: 503,
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiServiceError({
      code: "ai_config_missing",
      message: "GEMINI_API_KEY is not configured",
      userMessage: "Gemini API anahtari eksik",
      status: 500,
    });
  }
  return apiKey;
}

function normalizeGeminiError(status: number, message: string): AiServiceError {
  if (status === 401 || status === 403) {
    return new AiServiceError({
      code: "ai_auth_failed",
      message,
      userMessage: "Gemini servisi yetkilendirilemedi",
      status: 500,
    });
  }

  if (status === 429) {
    return new AiServiceError({
      code: "ai_rate_limited",
      message,
      userMessage: "Gemini su anda yogun, biraz sonra tekrar dene",
      status,
      retryable: true,
    });
  }

  return new AiServiceError({
    code: status >= 500 ? "ai_provider_unavailable" : "ai_error",
    message,
    userMessage: "Gemini yaniti alinamadi",
    status,
    retryable: status >= 500,
  });
}
