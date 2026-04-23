import type { AiModelRoute, AiTask } from "./types";

export const AI_MODEL_ROUTES: Record<AiTask, AiModelRoute> = {
  "persona-analysis": {
    task: "persona-analysis",
    models: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
    timeoutMs: 28_000,
    maxAttemptsPerModel: 1,
  },
  "persona-chat": {
    task: "persona-chat",
    models: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
    timeoutMs: 18_000,
    maxAttemptsPerModel: 1,
  },
  "fast-reply": {
    task: "fast-reply",
    models: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
    timeoutMs: 12_000,
    maxAttemptsPerModel: 1,
  },
};

export function getModelRoute(task: AiTask): AiModelRoute {
  return AI_MODEL_ROUTES[task];
}
