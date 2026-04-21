import OpenAI from "openai";
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { AiServiceError } from "./types";
import type { MediaMemoryItem } from "@/lib/media/memory";
import { buildMediaMemorySummary, getComparableImageMemories } from "@/lib/media/memory";

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

export type ImageTopicRelation = "related" | "unrelated" | "unclear";
export type ImageMemoryMatch = "none" | "weak" | "strong";

export type ChatImageAnalysis = {
  description: string;
  topic_relation: ImageTopicRelation;
  conversation_bridge: string | null;
  memory_match: ImageMemoryMatch;
  memory_note: string | null;
};

export type ChatImageAnalysisInput = {
  imageUrl: string;
  caption: string | null;
  conversationContext: string;
  mediaMemory: MediaMemoryItem[];
};

export async function analyzeChatImage(
  input: ChatImageAnalysisInput
): Promise<ChatImageAnalysis> {
  const client = createImageClient();
  const model = getImageModel();
  const comparableMemories = getComparableImageMemories(input.mediaMemory, 3);
  const content: ChatCompletionContentPart[] = [
    {
      type: "text",
      text: buildImagePrompt(input),
    },
    {
      type: "image_url",
      image_url: {
        url: input.imageUrl,
        detail: "auto",
      },
    },
  ];

  comparableMemories.forEach((memory, index) => {
    if (!memory.storage_url) return;
    content.push({
      type: "text",
      text: `Gecmis fotograf ${index + 1}: ${memory.file_name ?? "isimsiz"}; baglam: ${[
        ...memory.context_before,
        ...memory.context_after,
      ]
        .filter(Boolean)
        .join(" / ")}`,
    });
    content.push({
      type: "image_url",
      image_url: {
        url: memory.storage_url,
        detail: "low",
      },
    });
  });

  try {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "Sen sohbet icinde gonderilen fotograflari tarafsiz analiz eden bir servis katmanisin. Sadece JSON dondur.",
      },
      {
        role: "user",
        content,
      },
    ];
    const completion = await client.chat.completions.create(
      {
        model,
        messages,
        max_tokens: 700,
        temperature: 0.15,
        response_format: { type: "json_object" },
      },
      { timeout: 45_000 }
    );

    return normalizeImageAnalysis(completion.choices[0]?.message?.content ?? "");
  } catch (error) {
    throw normalizeImageError(error);
  }
}

export function createFallbackImageAnalysis(caption: string | null): ChatImageAnalysis {
  return {
    description: caption
      ? `Kullanici bir fotograf gonderdi ve not olarak "${caption}" yazdi. Gorsel teknik olarak analiz edilemedi.`
      : "Kullanici bir fotograf gonderdi. Gorsel teknik olarak analiz edilemedi.",
    topic_relation: "unclear",
    conversation_bridge: null,
    memory_match: "none",
    memory_note: null,
  };
}

function buildImagePrompt(input: ChatImageAnalysisInput): string {
  return `Kullanici sohbet icinde bir fotograf gonderdi.

Fotograf notu: ${input.caption?.trim() || "Yok"}

Son sohbet baglami:
${input.conversationContext || "Yeterli sohbet baglami yok."}

Gecmis medya hafizasi:
${buildMediaMemorySummary(input.mediaMemory)}

Gorev:
1. Guncel fotografi kisa ve somut analiz et.
2. Fotograf son sohbet baglamiyla alakaliysa topic_relation "related" yap ve nasil baglanacagini conversation_bridge alanina yaz.
3. Alakasizsa topic_relation "unrelated" yap; konuyu zorla baglama.
4. Gecmis medya ile gercekten benziyorsa memory_match "strong" veya "weak" yap. Emin degilsen "none" yap. Asla uydurma hatira yazma.

JSON semasi:
{
  "description": "fotografta gorulenleri kisa ve net anlat",
  "topic_relation": "related" | "unrelated" | "unclear",
  "conversation_bridge": string | null,
  "memory_match": "none" | "weak" | "strong",
  "memory_note": string | null
}`;
}

function normalizeImageAnalysis(raw: string): ChatImageAnalysis {
  const root = asObject(parseJsonObject(raw));
  return {
    description: asString(root.description, "Kullanici bir fotograf gonderdi."),
    topic_relation: asTopicRelation(root.topic_relation),
    conversation_bridge: asNullableString(root.conversation_bridge),
    memory_match: asMemoryMatch(root.memory_match),
    memory_note: asNullableString(root.memory_note),
  };
}

function parseJsonObject(text: string): unknown {
  const trimmed = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) return {};
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
}

function createImageClient(): OpenAI {
  const apiKey =
    getOptionalEnv("AI_IMAGE_OPENROUTER_API_KEY") ??
    getOptionalEnv("OPENROUTER_API_KEY") ??
    getOptionalEnv("AI_INTEGRATIONS_OPENAI_API_KEY");

  if (!apiKey) {
    throw new AiServiceError({
      code: "ai_config_missing",
      message: "Image analysis API key is not configured",
      userMessage: "Fotograf analiz servisi ayarli degil",
      status: 500,
    });
  }

  return new OpenAI({
    apiKey,
    baseURL:
      getOptionalEnv("AI_IMAGE_OPENROUTER_BASE_URL") ??
      getOptionalEnv("OPENROUTER_BASE_URL") ??
      getOptionalEnv("AI_INTEGRATIONS_OPENAI_BASE_URL") ??
      "https://openrouter.ai/api/v1",
    defaultHeaders: {
      ...(getOptionalEnv("OPENROUTER_APP_URL")
        ? { "HTTP-Referer": getOptionalEnv("OPENROUTER_APP_URL") }
        : {}),
      "X-OpenRouter-Title": getOptionalEnv("OPENROUTER_APP_NAME") ?? "Bendeki Sen",
    },
  });
}

function getImageModel(): string {
  return getOptionalEnv("AI_IMAGE_OPENROUTER_MODEL") ?? "openai/gpt-4o-mini";
}

function normalizeImageError(error: unknown): AiServiceError {
  if (error instanceof AiServiceError) return error;

  const err = getProviderErrorShape(error);
  const status = err.status ?? 500;
  const rawCode = err.error?.code ?? err.code ?? err.error?.type ?? err.type ?? "image_error";
  const rawMessage =
    err.error?.message ??
    err.message ??
    (error instanceof Error ? error.message : "Unknown image analysis error");

  return new AiServiceError({
    code: status >= 500 ? "ai_provider_unavailable" : "ai_error",
    message: `${rawCode}: ${rawMessage}`,
    userMessage: "Fotograf yorumlanamadi",
    status,
    retryable: status === 429 || status >= 500,
    cause: error,
  });
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asTopicRelation(value: unknown): ImageTopicRelation {
  return value === "related" || value === "unrelated" || value === "unclear"
    ? value
    : "unclear";
}

function asMemoryMatch(value: unknown): ImageMemoryMatch {
  return value === "weak" || value === "strong" ? value : "none";
}

function getProviderErrorShape(error: unknown): ProviderErrorShape {
  return typeof error === "object" && error !== null ? (error as ProviderErrorShape) : {};
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}
