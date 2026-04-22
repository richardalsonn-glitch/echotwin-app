import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import type {
  AiProvider,
  AiProviderStreamRequest,
  AiProviderTextRequest,
  FriendlyAiErrorCode,
} from "./types";
import { AiServiceError } from "./types";

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

function getProviderConfig(): {
  apiKey: string;
  baseURL: string;
  appURL?: string;
  appName: string;
} {
  const apiKey =
    process.env.OPENROUTER_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!apiKey) {
    throw new AiServiceError({
      code: "ai_config_missing",
      message: "OPENROUTER_API_KEY is not configured",
      userMessage: "AI servisi ayarlanmamış. Lütfen OpenRouter API anahtarını kontrol et.",
      status: 500,
    });
  }

  return {
    apiKey,
    baseURL:
      process.env.OPENROUTER_BASE_URL ??
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ??
      "https://openrouter.ai/api/v1",
    appURL: process.env.OPENROUTER_APP_URL ?? process.env.OPENROUTER_SITE_URL,
    appName: process.env.OPENROUTER_APP_NAME ?? "BendekiSen",
  };
}

function createClient(): OpenAI {
  const config = getProviderConfig();

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    defaultHeaders: {
      ...(config.appURL ? { "HTTP-Referer": config.appURL } : {}),
      "X-OpenRouter-Title": config.appName,
    },
  });
}

function getProviderErrorShape(error: unknown): ProviderErrorShape {
  return typeof error === "object" && error !== null ? (error as ProviderErrorShape) : {};
}

export function normalizeOpenRouterError(error: unknown): AiServiceError {
  if (error instanceof AiServiceError) return error;

  const err = getProviderErrorShape(error);
  const status = err.status ?? 500;
  const rawCode = err.error?.code ?? err.code ?? err.error?.type ?? err.type ?? "ai_error";
  const rawMessage =
    err.error?.message ??
    err.message ??
    (error instanceof Error ? error.message : "Unknown AI provider error");

  const lowerMessage = rawMessage.toLowerCase();
  let code: FriendlyAiErrorCode = "ai_error";
  let userMessage = "AI servisi şu anda yanıt veremiyor. Lütfen biraz sonra tekrar dene.";
  let retryable = status === 429 || status >= 500;

  if (status === 401 || status === 403) {
    code = "ai_auth_failed";
    userMessage = "AI servis anahtarı geçersiz veya yetkisiz. Lütfen OpenRouter ayarını kontrol et.";
    retryable = false;
  } else if (status === 429) {
    code = "ai_rate_limited";
    userMessage = "Ücretsiz model limiti doldu, biraz sonra tekrar dene.";
  } else if (status === 408 || lowerMessage.includes("timeout")) {
    code = "ai_timeout";
    userMessage = "Şu an analiz servisi yoğun, lütfen tekrar dene.";
    retryable = true;
  } else if (status >= 500 || lowerMessage.includes("provider returned error")) {
    code = "ai_provider_unavailable";
    userMessage = "Şu an analiz servisi yoğun, lütfen tekrar dene.";
    retryable = true;
  }

  return new AiServiceError({
    code,
    status,
    message: `${rawCode}: ${rawMessage}`,
    userMessage,
    retryable,
    cause: error,
  });
}

function toCompletionParams(
  request: AiProviderTextRequest
): ChatCompletionCreateParamsNonStreaming {
  return {
    model: request.model,
    messages: request.messages,
    max_tokens: request.maxTokens,
    temperature: request.temperature,
    ...(request.responseFormat
      ? { response_format: { type: request.responseFormat } }
      : {}),
  };
}

export function createOpenRouterProvider(): AiProvider {
  return {
    name: "openrouter",
    async createText(request) {
      try {
        const client = createClient();
        const completion = await client.chat.completions.create(toCompletionParams(request), {
          timeout: request.timeoutMs,
        });

        return completion.choices[0]?.message?.content ?? "";
      } catch (error) {
        throw normalizeOpenRouterError(error);
      }
    },
    async createStream(request: AiProviderStreamRequest) {
      try {
        const client = createClient();
        const stream = await client.chat.completions.create(
          {
            model: request.model,
            messages: request.messages,
            max_tokens: request.maxTokens,
            temperature: request.temperature,
            stream: true,
          },
          { timeout: request.timeoutMs }
        );

        return (async function* streamContent() {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) yield content;
          }
        })();
      } catch (error) {
        throw normalizeOpenRouterError(error);
      }
    },
  };
}
