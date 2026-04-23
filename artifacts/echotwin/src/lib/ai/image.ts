import { generateGeminiImage } from "@/lib/ai/gemini";
import { AiServiceError } from "@/lib/ai/types";
import type { MediaMemoryItem } from "@/lib/media/memory";
import { buildMediaMemorySummary, getComparableImageMemories } from "@/lib/media/memory";

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
  const image = await loadImageAsBase64(input.imageUrl);
  const raw = await generateGeminiImage({
    systemInstruction:
      "Sen sohbet icinde gonderilen fotograflari tarafsiz analiz eden bir servis katmanisin. Sadece JSON dondur.",
    prompt: buildImagePrompt(input),
    image,
    temperature: 0.15,
    maxOutputTokens: 900,
    json: true,
  });

  return normalizeImageAnalysis(raw);
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
  const comparableMemories = getComparableImageMemories(input.mediaMemory, 3);
  const memoryHints = comparableMemories
    .map((memory, index) => {
      const context = [...memory.context_before, ...memory.context_after]
        .filter(Boolean)
        .join(" / ");
      return `Gecmis fotograf ${index + 1}: ${memory.file_name ?? "isimsiz"}; baglam: ${context}`;
    })
    .join("\n");

  return `Kullanici sohbet icinde bir fotograf gonderdi.

Fotograf notu: ${input.caption?.trim() || "Yok"}

Son sohbet baglami:
${input.conversationContext || "Yeterli sohbet baglami yok."}

Gecmis medya hafizasi:
${buildMediaMemorySummary(input.mediaMemory)}
${memoryHints ? `\nKarsilastirma ipuclari:\n${memoryHints}` : ""}

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

async function loadImageAsBase64(imageUrl: string): Promise<{ mimeType: string; base64: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new AiServiceError({
      code: "ai_invalid_response",
      message: `Image download failed: ${response.status}`,
      userMessage: "Fotograf analiz icin okunamadi",
      status: 502,
      retryable: true,
    });
  }
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    mimeType: contentType,
    base64: buffer.toString("base64"),
  };
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
