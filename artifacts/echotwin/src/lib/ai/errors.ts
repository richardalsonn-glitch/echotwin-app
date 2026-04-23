import { isAiServiceError } from "./types";

type ProviderErrorLike = {
  status?: number;
  code?: string | null;
  type?: string | null;
  message?: string;
  upstreamStatusCode?: number;
  error?: {
    code?: string | null;
    type?: string | null;
    message?: string;
    upstreamStatusCode?: number;
  };
};

type AiErrorResponse = {
  code: string;
  message: string;
  status: number;
  upstreamStatusCode?: number;
};

const USER_MESSAGES: Record<string, string> = {
  ai_rate_limited: "Gemini su anda yogun, biraz sonra tekrar dene.",
  ai_service_unavailable: "Gemini gecici olarak yanit veremiyor. Biraz sonra tekrar dene.",
  ai_timeout: "Istek zaman asimina ugradi. Biraz sonra tekrar dene.",
  ai_invalid_json: "AI yaniti bozulmus gorunuyor. Biraz sonra tekrar deneyelim.",
  ai_validation_error: "AI beklenen formatta yanit vermedi. Biraz sonra tekrar dene.",
  ai_empty_result: "AI bos bir yanit dondurdu. Biraz sonra tekrar dene.",
  ai_auth_failed: "Gemini yetkilendirilemedi. API anahtarini kontrol et.",
  ai_config_missing: "Gemini ayari eksik. API anahtarini kontrol et.",
  ai_provider_unavailable: "AI servisi su anda yanit veremiyor.",
  ai_error: "AI servisi su anda yanit veremiyor.",
};

export function getAiUserMessage(code: string, fallbackMessage?: string): string {
  return USER_MESSAGES[code] ?? fallbackMessage ?? "AI servisi su anda yanit veremiyor.";
}

function getErrorLike(error: unknown): ProviderErrorLike {
  return typeof error === "object" && error !== null ? (error as ProviderErrorLike) : {};
}

export function getAiErrorResponse(error: unknown): AiErrorResponse {
  if (isAiServiceError(error)) {
    return {
      code: error.code,
      status: error.status,
      message: error.userMessage,
      upstreamStatusCode: error.upstreamStatusCode,
    };
  }

  const err = getErrorLike(error);
  const status = err.status ?? 500;
  const code = err.error?.code ?? err.code ?? err.error?.type ?? err.type ?? "ai_error";
  const rawMessage =
    err.error?.message ?? err.message ?? (error instanceof Error ? error.message : "AI hatasi");
  const upstreamStatusCode = err.error?.upstreamStatusCode ?? err.upstreamStatusCode ?? status;

  if (
    status === 429 &&
    (code === "insufficient_quota" ||
      rawMessage.toLowerCase().includes("exceeded your current quota"))
  ) {
    return {
      code: "ai_quota_exceeded",
      status: 429,
      message:
        "AI API kotasi dolmus veya billing/limit ayari yetersiz. Kullandigin saglayicinin kredi, odeme yontemi ve aylik harcama limitini kontrol et.",
      upstreamStatusCode,
    };
  }

  if (status === 429) {
    return {
      code: "ai_rate_limited",
      status: 429,
      message: getAiUserMessage("ai_rate_limited"),
      upstreamStatusCode,
    };
  }

  if (status === 503) {
    return {
      code: "ai_service_unavailable",
      status: 503,
      message: getAiUserMessage("ai_service_unavailable"),
      upstreamStatusCode,
    };
  }

  if (status === 504) {
    return {
      code: "ai_timeout",
      status: 504,
      message: getAiUserMessage("ai_timeout"),
      upstreamStatusCode,
    };
  }

  if (status === 401) {
    return {
      code: "ai_auth_failed",
      status: 500,
      message: getAiUserMessage("ai_auth_failed"),
      upstreamStatusCode,
    };
  }

  return {
    code,
    status,
    message: rawMessage,
    upstreamStatusCode,
  };
}
