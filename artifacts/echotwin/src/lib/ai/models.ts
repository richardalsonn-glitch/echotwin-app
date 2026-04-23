import type { AiModelRoute, AiTask } from "./types";

export const AI_MODEL_ROUTES: Record<AiTask, AiModelRoute> = {
  "persona-analysis": {
    task: "persona-analysis",
    models: ["gemini-2.5-flash"],
    timeoutMs: 60_000,
    maxAttemptsPerModel: 2,
  },
  "persona-chat": {
    task: "persona-chat",
    models: ["gemini-2.5-flash"],
    timeoutMs: 45_000,
    maxAttemptsPerModel: 2,
  },
  "fast-reply": {
    task: "fast-reply",
    models: ["gemini-2.5-flash"],
    timeoutMs: 25_000,
    maxAttemptsPerModel: 2,
  },
};

export function getModelRoute(task: AiTask): AiModelRoute {
  return AI_MODEL_ROUTES[task];
}
