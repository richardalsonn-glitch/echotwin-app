import type { PersonaAnalysis } from "@/types/persona";
import { runStreamWithFallback, runTextWithFallback } from "./provider";
import type {
  AiMessage,
  FastReplyInput,
  PersonaAnalysisInput,
  PersonaAnalysisResult,
  PersonaChatInput,
  AiStreamResult,
} from "./types";
import { AiServiceError } from "./types";

type JsonObject = Record<string, unknown>;

const PERSONA_ANALYSIS_SCHEMA = `{
  "avg_message_length": number,
  "short_reply_ratio": number,
  "emoji_usage": {
    "frequency": "never" | "rare" | "moderate" | "frequent",
    "common_emojis": string[]
  },
  "tone_style": string,
  "affection_level": number,
  "argument_style": string,
  "common_phrases": string[],
  "style_examples": string[],
  "response_patterns": {
    "tends_to_ask_back": boolean,
    "uses_long_messages": boolean,
    "uses_abbreviations": boolean,
    "sends_multiple_messages": boolean
  },
  "do_not_behaviors": string[],
  "mood_distribution": {
    "casual": number,
    "flirty": number,
    "moody": number,
    "argumentative": number,
    "soft": number
  },
  "signature_openings": string[],
  "language_mix": "turkish_only" | "mostly_turkish" | "mixed" | "mostly_english" | "english_only"
}`;

function asObject(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, maxItems);
}

function asEmojiFrequency(value: unknown): PersonaAnalysis["emoji_usage"]["frequency"] {
  return value === "never" ||
    value === "rare" ||
    value === "moderate" ||
    value === "frequent"
    ? value
    : "rare";
}

function asLanguageMix(value: unknown): PersonaAnalysis["language_mix"] {
  return value === "turkish_only" ||
    value === "mostly_turkish" ||
    value === "mixed" ||
    value === "mostly_english" ||
    value === "english_only"
    ? value
    : "mostly_turkish";
}

function normalizePersonaAnalysis(value: unknown): PersonaAnalysis {
  const root = asObject(value);
  const emojiUsage = asObject(root.emoji_usage);
  const responsePatterns = asObject(root.response_patterns);
  const moodDistribution = asObject(root.mood_distribution);

  return {
    avg_message_length: asNumber(root.avg_message_length, 60),
    short_reply_ratio: asNumber(root.short_reply_ratio, 0.5),
    emoji_usage: {
      frequency: asEmojiFrequency(emojiUsage.frequency),
      common_emojis: asStringArray(emojiUsage.common_emojis, 5),
    },
    tone_style: asString(root.tone_style, "kısa ve doğal"),
    affection_level: Math.min(10, Math.max(1, asNumber(root.affection_level, 4))),
    argument_style: asString(root.argument_style, "doğrudan"),
    common_phrases: asStringArray(root.common_phrases, 12),
    style_examples: asStringArray(root.style_examples, 12),
    response_patterns: {
      tends_to_ask_back: asBoolean(responsePatterns.tends_to_ask_back, false),
      uses_long_messages: asBoolean(responsePatterns.uses_long_messages, false),
      uses_abbreviations: asBoolean(responsePatterns.uses_abbreviations, false),
      sends_multiple_messages: asBoolean(responsePatterns.sends_multiple_messages, false),
    },
    do_not_behaviors: asStringArray(root.do_not_behaviors, 5),
    mood_distribution: {
      casual: asNumber(moodDistribution.casual, 60),
      flirty: asNumber(moodDistribution.flirty, 0),
      moody: asNumber(moodDistribution.moody, 10),
      argumentative: asNumber(moodDistribution.argumentative, 5),
      soft: asNumber(moodDistribution.soft, 25),
    },
    signature_openings: asStringArray(root.signature_openings, 3),
    language_mix: asLanguageMix(root.language_mix),
  };
}

function extractJsonObject(text: string): unknown {
  const withoutFences = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    const firstBrace = withoutFences.indexOf("{");
    const lastBrace = withoutFences.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("No JSON object found");
    }
    return JSON.parse(withoutFences.slice(firstBrace, lastBrace + 1));
  }
}

async function repairPersonaAnalysisJson(rawResponse: string): Promise<PersonaAnalysisResult> {
  const repair = await runTextWithFallback({
    task: "fast-reply",
    maxTokens: 1800,
    temperature: 0.1,
    responseFormat: "json_object",
    messages: [
      {
        role: "system",
        content:
          "Geçersiz ya da dağınık model çıktısını strict JSON objesine dönüştür. Sadece JSON döndür.",
      },
      {
        role: "user",
        content: `Beklenen şema:\n${PERSONA_ANALYSIS_SCHEMA}\n\nDüzeltilecek çıktı:\n${rawResponse}`,
      },
    ],
  });

  try {
    return {
      analysis: normalizePersonaAnalysis(extractJsonObject(repair.content)),
      rawResponse: repair.content,
      provider: repair.provider,
      model: repair.model,
      attempts: repair.attempts,
    };
  } catch (error) {
    throw new AiServiceError({
      code: "ai_invalid_response",
      message: "AI analysis JSON repair failed",
      userMessage: "Analiz sonucu işlenemedi. Lütfen tekrar dene.",
      status: 502,
      retryable: true,
      attempts: repair.attempts,
      cause: error,
    });
  }
}

export async function runPersonaAnalysis(
  input: PersonaAnalysisInput
): Promise<PersonaAnalysisResult> {
  const result = await runTextWithFallback({
    task: "persona-analysis",
    maxTokens: 2400,
    temperature: 0.2,
    responseFormat: "json_object",
    messages: [
      {
        role: "system",
        content:
          "Sen bir WhatsApp konuşma tarzı analiz servisisin. Yalnızca geçerli JSON döndür.",
      },
      { role: "user", content: input.prompt },
    ],
  });

  try {
    return {
      analysis: normalizePersonaAnalysis(extractJsonObject(result.content)),
      rawResponse: result.content,
      provider: result.provider,
      model: result.model,
      attempts: result.attempts,
    };
  } catch {
    const repaired = await repairPersonaAnalysisJson(result.content);
    return {
      ...repaired,
      attempts: [...result.attempts, ...repaired.attempts],
    };
  }
}

export async function runPersonaChat(input: PersonaChatInput): Promise<AiStreamResult> {
  const history: AiMessage[] = input.conversationHistory.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  return runStreamWithFallback({
    task: "persona-chat",
    maxTokens: 512,
    temperature: 0.45,
    messages: [
      { role: "system", content: input.systemPrompt },
      ...history,
      { role: "user", content: input.userMessage },
    ],
  });
}

export async function runFastReply(input: FastReplyInput): Promise<string> {
  const result = await runTextWithFallback({
    task: "fast-reply",
    maxTokens: input.maxTokens ?? 256,
    temperature: 0.35,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userMessage },
    ],
  });

  return result.content.trim();
}
