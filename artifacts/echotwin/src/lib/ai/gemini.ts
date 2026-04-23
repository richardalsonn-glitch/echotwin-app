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
  model?: string;
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
  responseSchema?: Record<string, unknown>;
  timeoutMs?: number;
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
  const model = params.request.model?.trim() || process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
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
  const timeout = setTimeout(() => controller.abort(), params.request.timeoutMs ?? 25_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const rawBody = await response.text();
    const payload = parseJsonObject(rawBody) as GeminiGenerateResponse;

    if (!response.ok) {
      const message = payload.error?.message ?? (rawBody.trim() || response.statusText);
      throw normalizeGeminiError(
        response.status,
        message
      );
    }

    const text =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

    if (!text) {
      throw new AiServiceError({
        code: "ai_empty_result",
        message: "Gemini returned empty content",
        userMessage: "AI bos bir yanit dondurdu. Lutfen tekrar dene.",
        status: 502,
        retryable: false,
        fallbackEligible: true,
      });
    }

    return text;
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AiServiceError({
        code: "ai_timeout",
        message: "Gemini request timed out",
        userMessage: "AI istegi zaman asimina ugradi. Lutfen tekrar dene.",
        status: 504,
        retryable: true,
        fallbackEligible: true,
        cause: error,
      });
    }
    throw new AiServiceError({
      code: "ai_service_unavailable",
      message: error instanceof Error ? error.message : "Gemini request failed",
      userMessage: "AI servisi su anda yanit veremiyor. Lutfen tekrar dene.",
      status: 503,
      retryable: true,
      fallbackEligible: true,
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
      userMessage: "Gemini yetkilendirilemedi. API anahtarini kontrol et.",
      status: 500,
      fallbackEligible: false,
      upstreamStatusCode: status,
    });
  }

  if (status === 429) {
    return new AiServiceError({
      code: "ai_rate_limited",
      message,
      userMessage: "Gemini su anda cok yogun. Biraz sonra tekrar dene.",
      status,
      retryable: true,
      fallbackEligible: true,
      upstreamStatusCode: status,
    });
  }

  if (status === 503) {
    return new AiServiceError({
      code: "ai_service_unavailable",
      message,
      userMessage: "Gemini gecici olarak ulasilamiyor. Biraz sonra tekrar dene.",
      status,
      retryable: true,
      fallbackEligible: true,
      upstreamStatusCode: status,
    });
  }

  if (status === 504) {
    return new AiServiceError({
      code: "ai_timeout",
      message,
      userMessage: "Gemini yaniti zaman asimina ugradi. Lutfen tekrar dene.",
      status,
      retryable: true,
      fallbackEligible: true,
      upstreamStatusCode: status,
    });
  }

  return new AiServiceError({
    code: status >= 500 ? "ai_provider_unavailable" : "ai_error",
    message,
    userMessage: status >= 500 ? "Gemini yaniti alinamadi." : "Gemini istegi basarisiz oldu.",
    status,
    retryable: status >= 500,
    fallbackEligible: status >= 500,
    upstreamStatusCode: status,
  });
}

function parseJsonObject(rawBody: string): unknown {
  const trimmed = rawBody.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      return {};
    }

    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      return {};
    }
  }
}
