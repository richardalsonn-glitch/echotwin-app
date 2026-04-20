type OpenAIErrorLike = {
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

type AiErrorResponse = {
  code: string;
  message: string;
  status: number;
};

function getErrorLike(error: unknown): OpenAIErrorLike {
  return typeof error === "object" && error !== null ? (error as OpenAIErrorLike) : {};
}

export function getAiErrorResponse(error: unknown): AiErrorResponse {
  const err = getErrorLike(error);
  const status = err.status ?? 500;
  const code = err.error?.code ?? err.code ?? err.error?.type ?? err.type ?? "ai_error";
  const rawMessage =
    err.error?.message ?? err.message ?? (error instanceof Error ? error.message : "AI hatasi");

  if (
    status === 429 &&
    (code === "insufficient_quota" ||
      rawMessage.toLowerCase().includes("exceeded your current quota"))
  ) {
    return {
      code: "openai_quota_exceeded",
      status: 429,
      message:
        "OpenAI API kotasi dolmus veya billing/limit ayari yetersiz. OpenAI Platform > Billing ve Usage Limits alanindan kredi, odeme yontemi ve aylik harcama limitini kontrol et.",
    };
  }

  if (status === 429) {
    return {
      code: "openai_rate_limited",
      status: 429,
      message:
        "OpenAI API su anda cok fazla istek aliyor. Biraz bekleyip tekrar dene.",
    };
  }

  if (status === 401) {
    return {
      code: "openai_auth_failed",
      status: 500,
      message:
        "OpenAI API anahtari gecersiz veya eksik. AI_INTEGRATIONS_OPENAI_API_KEY degerini kontrol et.",
    };
  }

  return {
    code,
    status,
    message: rawMessage,
  };
}
