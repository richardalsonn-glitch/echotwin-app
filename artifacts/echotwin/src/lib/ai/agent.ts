import { z } from "zod";
import type { PersonaAnalysis } from "@/types/persona";
import { runStreamWithFallback, runTextWithFallback } from "./provider";
import type {
  AiMessage,
  FastReplyInput,
  PersonaAnalysisInput,
  PersonaAnalysisResult,
  PersonaChatInput,
  PersonaChatGenerationResult,
  AiStreamResult,
} from "./types";
import { AiServiceError } from "./types";
import { getAiUserMessage } from "./errors";
import { buildChatRegenerationPrompt } from "./prompts";

const MAX_CHAT_HISTORY_MESSAGES = 40;

const PERSONA_ANALYSIS_SCHEMA = z
  .object({
    relationship_type: z.string().min(1).optional().default("unknown"),
    warmth_level: z.coerce.number().finite().min(1).max(10).optional().default(5),
    reply_length_preference: z
      .enum(["very_short", "short", "mixed", "medium", "long"])
      .optional()
      .default("mixed"),
    initiative_level: z.enum(["low", "medium", "high"]).optional().default("medium"),
    emoji_habit: z.enum(["never", "rare", "moderate", "frequent"]).optional().default("rare"),
    typo_tolerance: z.enum(["low", "medium", "high"]).optional().default("medium"),
    lowercase_ratio: z.coerce.number().finite().min(0).max(1).optional().default(0.5),
    filler_words: z.array(z.string().min(1)).max(10).optional().default([]),
    affection_style: z.string().min(1).optional().default("belirgin degil"),
    conflict_style: z.string().min(1).optional().default("dogrudan"),
    question_frequency: z.coerce.number().finite().min(0).max(1).optional().default(0.2),
    delay_style: z.string().min(1).optional().default("normal"),
    topic_preferences: z.array(z.string().min(1)).max(8).optional().default([]),
    avoid_patterns: z.array(z.string().min(1)).max(10).optional().default([]),
    speech_rhythm: z.string().min(1).optional().default("dogal"),
    avg_message_length: z.coerce.number().finite().min(0),
    short_reply_ratio: z.coerce.number().finite().min(0).max(1),
    emoji_usage: z
      .object({
        frequency: z.enum(["never", "rare", "moderate", "frequent"]),
        common_emojis: z.array(z.string().min(1)).max(5),
      })
      .strict(),
    tone_style: z.string().min(1),
    affection_level: z.coerce.number().finite().min(1).max(10),
    argument_style: z.string().min(1),
    common_phrases: z.array(z.string().min(1)).max(12),
    style_examples: z.array(z.string().min(1)).max(12).optional().default([]),
    response_patterns: z
      .object({
        tends_to_ask_back: z.coerce.boolean(),
        uses_long_messages: z.coerce.boolean(),
        uses_abbreviations: z.coerce.boolean(),
        sends_multiple_messages: z.coerce.boolean(),
      })
      .strict(),
    do_not_behaviors: z.array(z.string().min(1)).max(5),
    mood_distribution: z
      .object({
        casual: z.coerce.number().finite().min(0).max(100),
        flirty: z.coerce.number().finite().min(0).max(100),
        moody: z.coerce.number().finite().min(0).max(100),
        argumentative: z.coerce.number().finite().min(0).max(100),
        soft: z.coerce.number().finite().min(0).max(100),
      })
      .strict(),
    signature_openings: z.array(z.string().min(1)).max(3),
    language_mix: z.enum([
      "turkish_only",
      "mostly_turkish",
      "mixed",
      "mostly_english",
      "english_only",
    ]),
  })
  .strict();

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
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

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizePersonaAnalysis(value: unknown): PersonaAnalysis {
  const root = asObject(value);
  const emojiUsage = asObject(root.emoji_usage);
  const responsePatterns = asObject(root.response_patterns);
  const moodDistribution = asObject(root.mood_distribution);

  return {
    relationship_type: asString(root.relationship_type, "unknown"),
    warmth_level: Math.min(10, Math.max(1, asNumber(root.warmth_level, 5))),
    reply_length_preference: asEnum(
      root.reply_length_preference,
      ["very_short", "short", "mixed", "medium", "long"] as const,
      "mixed"
    ),
    initiative_level: asEnum(root.initiative_level, ["low", "medium", "high"] as const, "medium"),
    emoji_habit: asEnum(
      root.emoji_habit,
      ["never", "rare", "moderate", "frequent"] as const,
      asEmojiFrequency(emojiUsage.frequency)
    ),
    typo_tolerance: asEnum(root.typo_tolerance, ["low", "medium", "high"] as const, "medium"),
    lowercase_ratio: Math.min(1, Math.max(0, asNumber(root.lowercase_ratio, 0.5))),
    filler_words: asStringArray(root.filler_words, 10),
    affection_style: asString(root.affection_style, "belirgin degil"),
    conflict_style: asString(root.conflict_style, asString(root.argument_style, "dogrudan")),
    question_frequency: Math.min(1, Math.max(0, asNumber(root.question_frequency, 0.2))),
    delay_style: asString(root.delay_style, "normal"),
    topic_preferences: asStringArray(root.topic_preferences, 8),
    avoid_patterns: asStringArray(root.avoid_patterns, 10),
    speech_rhythm: asString(root.speech_rhythm, "dogal"),
    avg_message_length: asNumber(root.avg_message_length, 60),
    short_reply_ratio: asNumber(root.short_reply_ratio, 0.5),
    emoji_usage: {
      frequency: asEmojiFrequency(emojiUsage.frequency),
      common_emojis: asStringArray(emojiUsage.common_emojis, 5),
    },
    tone_style: asString(root.tone_style, "kisa ve dogal"),
    affection_level: Math.min(10, Math.max(1, asNumber(root.affection_level, 4))),
    argument_style: asString(root.argument_style, "dogrudan"),
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
      throw new AiServiceError({
        code: "ai_invalid_json",
        message: "No JSON object found",
        userMessage: getAiUserMessage("ai_invalid_json"),
        status: 502,
        retryable: false,
        fallbackEligible: true,
      });
    }

    try {
      return JSON.parse(withoutFences.slice(firstBrace, lastBrace + 1));
    } catch (error) {
      throw new AiServiceError({
        code: "ai_invalid_json",
        message: error instanceof Error ? error.message : "JSON parse failed",
        userMessage: getAiUserMessage("ai_invalid_json"),
        status: 502,
        retryable: false,
        fallbackEligible: true,
        cause: error,
      });
    }
  }
}

function parsePersonaAnalysis(rawResponse: string): PersonaAnalysis {
  const parsed = extractJsonObject(rawResponse);
  const validation = PERSONA_ANALYSIS_SCHEMA.safeParse(parsed);

  if (!validation.success) {
    throw new AiServiceError({
      code: "ai_validation_error",
      message: validation.error.message,
      userMessage: getAiUserMessage("ai_validation_error"),
      status: 422,
      retryable: false,
      fallbackEligible: true,
      cause: validation.error,
    });
  }

  return normalizePersonaAnalysis(validation.data);
}

export async function runPersonaAnalysis(
  input: PersonaAnalysisInput
): Promise<PersonaAnalysisResult> {
  const result = await runTextWithFallback<PersonaAnalysis>({
    task: "persona-analysis",
    maxTokens: 2400,
    temperature: 0.2,
    responseFormat: "json_object",
    parseResponse: parsePersonaAnalysis,
    messages: [
      {
        role: "system",
        content: "Sen bir WhatsApp konusma tarzi analiz servisisin. Yalnizca gecerli JSON dondur.",
      },
      { role: "user", content: input.prompt },
    ],
  });

  return {
    analysis: result.content,
    rawResponse: result.rawContent,
    provider: result.provider,
    model: result.model,
    attempts: result.attempts,
  };
}

export async function runPersonaChat(input: PersonaChatInput): Promise<AiStreamResult> {
  const history: AiMessage[] = input.conversationHistory.slice(-MAX_CHAT_HISTORY_MESSAGES).map((message) => ({
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

export async function runPersonaChatGeneration(
  input: PersonaChatInput
): Promise<PersonaChatGenerationResult> {
  const history: AiMessage[] = input.conversationHistory.slice(-MAX_CHAT_HISTORY_MESSAGES).map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const baseRequest = {
    task: "persona-chat" as const,
    maxTokens: 220,
    temperature: 0.78,
    messages: [
      { role: "system" as const, content: input.systemPrompt },
      ...history,
      { role: "user" as const, content: input.userMessage },
    ],
  };
  const first = await runTextWithFallback(baseRequest);
  const firstReply = cleanupReply(first.content);
  const firstCheck = evaluateHumanRealism(firstReply, input.userMessage);

  if (!firstCheck.rejectedForAiTone) {
    return {
      reply: firstReply,
      realismScore: firstCheck.score,
      matchedStyleSignals: firstCheck.signals,
      rejectedForAiTone: false,
      fallbackUsed: first.attempts.some((attempt) => attempt.status === "failed"),
      modelUsed: first.model,
      provider: first.provider,
      attempts: first.attempts,
    };
  }

  const retryPrompt = buildChatRegenerationPrompt({
    originalPrompt: input.systemPrompt,
    rejectedReply: firstReply,
    rejectionReasons: firstCheck.reasons,
  });
  const second = await runTextWithFallback({
    ...baseRequest,
    temperature: 0.86,
    messages: [
      { role: "system", content: retryPrompt },
      ...history.slice(-16),
      { role: "user", content: input.userMessage },
    ],
  });
  const secondReply = cleanupReply(second.content);
  const secondCheck = evaluateHumanRealism(secondReply, input.userMessage);

  return {
    reply: secondReply || firstReply,
    realismScore: secondCheck.score,
    matchedStyleSignals: secondCheck.signals,
    rejectedForAiTone: true,
    fallbackUsed:
      first.attempts.some((attempt) => attempt.status === "failed") ||
      second.attempts.some((attempt) => attempt.status === "failed"),
    modelUsed: second.model,
    provider: second.provider,
    attempts: [...first.attempts, ...second.attempts],
  };
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

function cleanupReply(reply: string): string {
  return reply
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/^(assistant|asistan|ai|bot|model|cevap)\s*:\s*/i, "")
    .trim();
}

function evaluateHumanRealism(
  reply: string,
  userMessage: string
): {
  score: number;
  signals: string[];
  reasons: string[];
  rejectedForAiTone: boolean;
} {
  const normalized = reply.toLocaleLowerCase("tr-TR").trim();
  const reasons: string[] = [];
  const signals: string[] = [];
  const aiPatterns = [
    "tabii",
    "elbette",
    "memnuniyetle",
    "sana yardımcı olabilirim",
    "sana yardimci olabilirim",
    "anlıyorum",
    "anliyorum",
    "bu durumda",
    "dilersen",
    "yardımcı olayım",
    "yardimci olayim",
  ];

  if (!normalized) reasons.push("empty_reply");
  if (aiPatterns.some((pattern) => normalized.includes(pattern))) {
    reasons.push("ai_phrase");
  }
  if (reply.length > Math.max(220, userMessage.length * 4)) {
    reasons.push("too_explanatory");
  }
  if ((reply.match(/[.!?]/g) ?? []).length > 4 && reply.length > 120) {
    reasons.push("over_punctuated");
  }
  if (/\b(öncelikle|sonuç olarak|özetle|burada|şunu söyleyebilirim)\b/iu.test(reply)) {
    reasons.push("essay_tone");
  }

  if (reply.length <= 90) signals.push("short_dm_length");
  if (reply.includes("\n")) signals.push("multi_bubble_feel");
  if (reply === reply.toLocaleLowerCase("tr-TR")) signals.push("lowercase_style");
  if (/\b(ya|he|hee|tm|tamam|aynen|yok|bilmem|nap|napi|napı|kanka|cnm)\b/iu.test(reply)) {
    signals.push("daily_turkish_marker");
  }
  if (!reply.endsWith("?")) signals.push("not_question_ending");

  const score = Math.max(0, Math.min(100, 70 + signals.length * 7 - reasons.length * 22));
  return {
    score,
    signals,
    reasons,
    rejectedForAiTone: reasons.length > 0 || score < 58,
  };
}
