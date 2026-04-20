import OpenAI from "openai";

const apiKey =
  process.env.OPENROUTER_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

const usesOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);

const baseURL =
  (usesOpenRouter
    ? (process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1")
    : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);

if (!baseURL) {
  throw new Error("AI base URL is not set");
}

if (!apiKey) {
  throw new Error("AI API key is not set");
}

export const openai = new OpenAI({
  apiKey,
  baseURL,
  defaultHeaders: {
    ...(process.env.OPENROUTER_SITE_URL
      ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL }
      : {}),
    ...(process.env.OPENROUTER_APP_NAME
      ? { "X-OpenRouter-Title": process.env.OPENROUTER_APP_NAME }
      : {}),
  },
});
