import OpenAI from "openai";

const apiKey =
  process.env.OPENROUTER_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

const baseURL =
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ??
  (process.env.OPENROUTER_API_KEY ? "https://openrouter.ai/api/v1" : undefined);

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
