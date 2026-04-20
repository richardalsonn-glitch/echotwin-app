import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { PersonaAnalysis } from "@/types/persona";

export type AiTask = "persona-analysis" | "persona-chat" | "fast-reply";

export type AiProviderName = "openrouter";

export type AiMessage = Extract<
  ChatCompletionMessageParam,
  { role: "system" | "user" | "assistant" }
>;

export type AiModelRoute = {
  task: AiTask;
  models: readonly string[];
  timeoutMs: number;
  maxAttemptsPerModel: number;
};

export type AiAttempt = {
  provider: AiProviderName;
  task: AiTask;
  model: string;
  status: "success" | "failed";
  statusCode?: number;
  code?: string;
  message?: string;
};

export type AiTextRequest = {
  task: AiTask;
  messages: AiMessage[];
  maxTokens: number;
  temperature: number;
  responseFormat?: "json_object";
};

export type AiStreamRequest = {
  task: AiTask;
  messages: AiMessage[];
  maxTokens: number;
  temperature: number;
};

export type AiTextResult = {
  content: string;
  provider: AiProviderName;
  model: string;
  attempts: AiAttempt[];
};

export type AiStreamResult = {
  stream: AsyncIterable<string>;
  provider: AiProviderName;
  model: string;
  attempts: AiAttempt[];
};

export type AiProviderTextRequest = Omit<AiTextRequest, "task"> & {
  model: string;
  timeoutMs: number;
};

export type AiProviderStreamRequest = Omit<AiStreamRequest, "task"> & {
  model: string;
  timeoutMs: number;
};

export type AiProvider = {
  name: AiProviderName;
  createText(request: AiProviderTextRequest): Promise<string>;
  createStream(request: AiProviderStreamRequest): Promise<AsyncIterable<string>>;
};

export type PersonaAnalysisInput = {
  prompt: string;
};

export type PersonaAnalysisResult = {
  analysis: PersonaAnalysis;
  rawResponse: string;
  provider: AiProviderName;
  model: string;
  attempts: AiAttempt[];
};

export type PersonaChatInput = {
  systemPrompt: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
};

export type FastReplyInput = {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
};

export type FriendlyAiErrorCode =
  | "ai_config_missing"
  | "ai_rate_limited"
  | "ai_provider_unavailable"
  | "ai_timeout"
  | "ai_invalid_response"
  | "ai_auth_failed"
  | "ai_error";

export class AiServiceError extends Error {
  readonly code: FriendlyAiErrorCode;
  readonly status: number;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly attempts: AiAttempt[];

  constructor(params: {
    code: FriendlyAiErrorCode;
    message: string;
    userMessage: string;
    status?: number;
    retryable?: boolean;
    attempts?: AiAttempt[];
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "AiServiceError";
    this.code = params.code;
    this.status = params.status ?? 500;
    this.userMessage = params.userMessage;
    this.retryable = params.retryable ?? false;
    this.attempts = params.attempts ?? [];
    this.cause = params.cause;
  }
}

export function isAiServiceError(error: unknown): error is AiServiceError {
  return error instanceof AiServiceError;
}
