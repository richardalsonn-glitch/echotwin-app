import { getModelRoute } from "./models";
import { createGeminiProvider } from "./gemini-provider";
import type {
  AiAttempt,
  AiStreamRequest,
  AiStreamResult,
  AiTextRequest,
  AiTextResult,
} from "./types";
import { AiServiceError, isAiServiceError } from "./types";

function logAttempt(attempt: AiAttempt): void {
  if (attempt.status === "success") {
    console.info(
      `[ai] provider=${attempt.provider} task=${attempt.task} model=${attempt.model} status=success`
    );
    return;
  }

  console.warn(
    `[ai] provider=${attempt.provider} task=${attempt.task} model=${attempt.model} status=failed code=${attempt.code ?? "unknown"} statusCode=${attempt.statusCode ?? "unknown"}`
  );
}

function shouldTryNextModel(error: unknown): boolean {
  return isAiServiceError(error) ? error.retryable : true;
}

function shouldRetrySameModel(
  error: unknown,
  attemptIndex: number,
  maxAttempts: number
): boolean {
  if (attemptIndex + 1 >= maxAttempts) return false;
  if (!isAiServiceError(error)) return true;
  if (!error.retryable) return false;
  return true;
}

function getRetryDelayMs(attemptIndex: number): number {
  const baseDelay = 650 * 2 ** attemptIndex;
  const jitter = Math.round(Math.random() * 180);
  return baseDelay + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildFailedAttempt(
  request: AiTextRequest | AiStreamRequest,
  model: string,
  error: unknown
): AiAttempt {
  const aiError = isAiServiceError(error)
    ? error
    : new AiServiceError({
        code: "ai_error",
        message: error instanceof Error ? error.message : "Unknown AI error",
        userMessage: "AI servisi şu anda yanıt veremiyor. Lütfen biraz sonra tekrar dene.",
      });

  return {
    provider: "gemini",
    task: request.task,
    model,
    status: "failed",
    statusCode: aiError.status,
    code: aiError.code,
    message: aiError.message,
  };
}

function buildSuccessAttempt(
  request: AiTextRequest | AiStreamRequest,
  model: string
): AiAttempt {
  return {
    provider: "gemini",
    task: request.task,
    model,
    status: "success",
  };
}

function buildFinalError(attempts: AiAttempt[], cause: unknown): AiServiceError {
  const lastFailed = [...attempts].reverse().find((attempt) => attempt.status === "failed");
  const sourceError = isAiServiceError(cause) ? cause : undefined;
  const code = sourceError?.code ?? "ai_provider_unavailable";
  const status = sourceError?.status ?? lastFailed?.statusCode ?? 503;

  return new AiServiceError({
    code,
    status,
    message: sourceError?.message ?? lastFailed?.message ?? "All AI models failed",
    userMessage:
      code === "ai_rate_limited"
        ? "Ücretsiz model limiti doldu, biraz sonra tekrar dene."
        : "Şu an analiz servisi yoğun, lütfen tekrar dene.",
    retryable: true,
    attempts,
    cause,
  });
}

export async function runTextWithFallback(request: AiTextRequest): Promise<AiTextResult> {
  const route = getModelRoute(request.task);
  const provider = createGeminiProvider();
  const attempts: AiAttempt[] = [];
  let lastError: unknown;

  for (const model of route.models) {
    const maxAttempts = Math.max(1, route.maxAttemptsPerModel);

    for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
      try {
        const content = await provider.createText({
          messages: request.messages,
          maxTokens: request.maxTokens,
          temperature: request.temperature,
          responseFormat: request.responseFormat,
          model,
          timeoutMs: route.timeoutMs,
        });
        const success = buildSuccessAttempt(request, model);
        attempts.push(success);
        logAttempt(success);
        return { content, provider: provider.name, model, attempts };
      } catch (error) {
        lastError = error;
        const failed = buildFailedAttempt(request, model, error);
        attempts.push(failed);
        logAttempt(failed);

        if (shouldRetrySameModel(error, attemptIndex, maxAttempts)) {
          const delayMs = getRetryDelayMs(attemptIndex);
          console.info(
            `[ai] retrying task=${request.task} model=${model} attempt=${attemptIndex + 2}/${maxAttempts} delayMs=${delayMs}`
          );
          await sleep(delayMs);
          continue;
        }

        if (!shouldTryNextModel(error)) {
          throw buildFinalError(attempts, error);
        }

        break;
      }
    }
  }

  throw buildFinalError(attempts, lastError);
}

export async function runStreamWithFallback(
  request: AiStreamRequest
): Promise<AiStreamResult> {
  const route = getModelRoute(request.task);
  const provider = createGeminiProvider();
  const attempts: AiAttempt[] = [];
  let lastError: unknown;

  for (const model of route.models) {
    const maxAttempts = Math.max(1, route.maxAttemptsPerModel);

    for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
      try {
        const stream = await provider.createStream({
          messages: request.messages,
          maxTokens: request.maxTokens,
          temperature: request.temperature,
          model,
          timeoutMs: route.timeoutMs,
        });
        const success = buildSuccessAttempt(request, model);
        attempts.push(success);
        logAttempt(success);
        return { stream, provider: provider.name, model, attempts };
      } catch (error) {
        lastError = error;
        const failed = buildFailedAttempt(request, model, error);
        attempts.push(failed);
        logAttempt(failed);

        if (shouldRetrySameModel(error, attemptIndex, maxAttempts)) {
          const delayMs = getRetryDelayMs(attemptIndex);
          console.info(
            `[ai] retrying task=${request.task} model=${model} attempt=${attemptIndex + 2}/${maxAttempts} delayMs=${delayMs}`
          );
          await sleep(delayMs);
          continue;
        }

        if (!shouldTryNextModel(error)) {
          throw buildFinalError(attempts, error);
        }

        break;
      }
    }
  }

  throw buildFinalError(attempts, lastError);
}
