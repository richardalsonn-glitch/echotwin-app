import type { AiModelRoute, AiTask } from "./types";

export const AI_MODEL_ROUTES: Record<AiTask, AiModelRoute> = {
  "persona-analysis": {
    task: "persona-analysis",
    models: [
      "openai/gpt-oss-120b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "openrouter/free",
    ],
    timeoutMs: 60_000,
    maxAttemptsPerModel: 2,
  },
  "persona-chat": {
    task: "persona-chat",
    models: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "minimax/minimax-m2.5:free",
      "openrouter/free",
    ],
    timeoutMs: 45_000,
    maxAttemptsPerModel: 2,
  },
  "fast-reply": {
    task: "fast-reply",
    models: ["minimax/minimax-m2.5:free", "openrouter/free"],
    timeoutMs: 25_000,
    maxAttemptsPerModel: 2,
  },
};

export function getModelRoute(task: AiTask): AiModelRoute {
  return AI_MODEL_ROUTES[task];
}
