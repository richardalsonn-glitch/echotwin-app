import type { PersonaAnalysis } from "@/types/persona";
import { runPersonaAnalysis } from "@/lib/ai/agent";
import { buildAnalysisPrompt } from "@/lib/ai/prompts";
import type { AiAttempt } from "@/lib/ai/types";

export type CachedChatMessage = {
  sender: string;
  content: string;
  has_question?: boolean;
  message_length?: number;
};

export type AnalysisPipelineStatus =
  | "queued"
  | "processing"
  | "retrying"
  | "completed"
  | "completed_basic"
  | "failed";

export type AnalysisPipelineResult = {
  analysis: PersonaAnalysis;
  status: Extract<AnalysisPipelineStatus, "completed" | "completed_basic">;
  provider: "gemini" | "basic-fallback";
  model: string;
  attempts: AiAttempt[];
  summaryCache: AnalysisSummaryCache;
  usedBasicFallback: boolean;
};

export type AnalysisSummaryCache = {
  version: 1;
  generated_at: string;
  total_messages: number;
  target_message_count: number;
  chunk_count: number;
  target_name: string;
  requester_name: string;
  deterministic_signals: DeterministicSignals;
};

type DeterministicSignals = {
  avg_message_length: number;
  short_reply_ratio: number;
  question_ratio: number;
  emoji_frequency: PersonaAnalysis["emoji_usage"]["frequency"];
  common_emojis: string[];
  common_phrases: string[];
  signature_openings: string[];
  language_mix: PersonaAnalysis["language_mix"];
  sends_multiple_messages: boolean;
  uses_abbreviations: boolean;
};

type PreparedAnalysisInput = {
  prompt: string;
  summaryCache: AnalysisSummaryCache;
};

const MAX_ANALYSIS_MESSAGES = 1_100;
const CHUNK_SIZE = 260;
const MIN_TARGET_MESSAGES = 5;

export function hasEnoughTargetMessages(
  messages: CachedChatMessage[],
  targetName: string
): boolean {
  return messages.filter((message) => message.sender === targetName).length >= MIN_TARGET_MESSAGES;
}

export async function runResilientPersonaAnalysis(params: {
  targetName: string;
  requesterName: string;
  messages: CachedChatMessage[];
}): Promise<AnalysisPipelineResult> {
  console.info(
    `[analysis] status=processing target=${params.targetName} totalMessages=${params.messages.length}`
  );

  const prepared = prepareAnalysisInput(params);

  try {
    const aiResult = await runPersonaAnalysis({ prompt: prepared.prompt });
    console.info(
      `[analysis] status=completed provider=${aiResult.provider} model=${aiResult.model} attempts=${aiResult.attempts.length}`
    );

    return {
      analysis: aiResult.analysis,
      status: "completed",
      provider: aiResult.provider,
      model: aiResult.model,
      attempts: aiResult.attempts,
      summaryCache: prepared.summaryCache,
      usedBasicFallback: false,
    };
  } catch (error) {
    console.warn("[analysis] AI analysis failed, using basic fallback", error);
    const fallback = buildBasicPersonaAnalysis(
      params.messages,
      params.targetName,
      prepared.summaryCache.deterministic_signals
    );

    return {
      analysis: fallback,
      status: "completed_basic",
      provider: "basic-fallback",
      model: "deterministic-signals-v1",
      attempts: [],
      summaryCache: prepared.summaryCache,
      usedBasicFallback: true,
    };
  }
}

function prepareAnalysisInput(params: {
  targetName: string;
  requesterName: string;
  messages: CachedChatMessage[];
}): PreparedAnalysisInput {
  const chunks = chunkMessages(params.messages, CHUNK_SIZE);
  const targetMessages = params.messages.filter((message) => message.sender === params.targetName);
  const deterministicSignals = extractDeterministicSignals(targetMessages);
  const sampledMessages = sampleMessagesForAnalysis(params.messages, params.targetName);
  const prompt = `${buildAnalysisPrompt(
    params.targetName,
    params.requesterName,
    sampledMessages.map((message) => ({
      sender: message.sender,
      content: message.content,
      has_question: message.has_question ?? message.content.includes("?"),
      message_length: message.message_length ?? message.content.length,
    }))
  )}

DAYANIKLILIK NOTU:
Bu sohbet ${params.messages.length} mesaj ve ${chunks.length} parca olarak on islendi.
Asagidaki deterministik sinyalleri kontrol sinyali olarak kullan, ancak final JSON semasindan cikma.

${JSON.stringify(deterministicSignals, null, 2)}`;

  return {
    prompt,
    summaryCache: {
      version: 1,
      generated_at: new Date().toISOString(),
      total_messages: params.messages.length,
      target_message_count: targetMessages.length,
      chunk_count: chunks.length,
      target_name: params.targetName,
      requester_name: params.requesterName,
      deterministic_signals: deterministicSignals,
    },
  };
}

function chunkMessages(messages: CachedChatMessage[], size: number): CachedChatMessage[][] {
  const chunks: CachedChatMessage[][] = [];
  for (let index = 0; index < messages.length; index += size) {
    chunks.push(messages.slice(index, index + size));
  }
  return chunks;
}

function sampleMessagesForAnalysis(
  messages: CachedChatMessage[],
  targetName: string
): CachedChatMessage[] {
  if (messages.length <= MAX_ANALYSIS_MESSAGES) return messages;

  const firstContext = messages.slice(0, 80);
  const lastContext = messages.slice(-360);
  const targetMessages = messages.filter((message) => message.sender === targetName);
  const sampledTarget = takeEvenly(targetMessages, 560);
  const seen = new Set<CachedChatMessage>();
  return [...firstContext, ...sampledTarget, ...lastContext].filter((message) => {
    if (seen.has(message)) return false;
    seen.add(message);
    return true;
  });
}

function takeEvenly<T>(items: T[], maxItems: number): T[] {
  if (items.length <= maxItems) return items;
  const result: T[] = [];
  const step = (items.length - 1) / (maxItems - 1);
  for (let index = 0; index < maxItems; index += 1) {
    result.push(items[Math.round(index * step)]);
  }
  return result;
}

function extractDeterministicSignals(targetMessages: CachedChatMessage[]): DeterministicSignals {
  const contents = targetMessages.map((message) => message.content.trim()).filter(Boolean);
  const lengths = contents.map((content) => content.length);
  const avgLength = average(lengths, 60);
  const shortReplyRatio =
    contents.length > 0
      ? contents.filter((content) => content.length < 50).length / contents.length
      : 0.5;
  const questionRatio =
    contents.length > 0
      ? contents.filter((content) => content.includes("?")).length / contents.length
      : 0;
  const commonEmojis = extractCommonEmojis(contents);
  const commonPhrases = extractCommonPhrases(contents);
  const signatureOpenings = extractSignatureOpenings(contents);

  return {
    avg_message_length: Math.round(avgLength),
    short_reply_ratio: roundRatio(shortReplyRatio),
    question_ratio: roundRatio(questionRatio),
    emoji_frequency: getEmojiFrequency(commonEmojis.length, contents.length),
    common_emojis: commonEmojis,
    common_phrases: commonPhrases,
    signature_openings: signatureOpenings,
    language_mix: detectLanguageMix(contents),
    sends_multiple_messages: shortReplyRatio > 0.58 && avgLength < 75,
    uses_abbreviations: detectAbbreviations(contents),
  };
}

function buildBasicPersonaAnalysis(
  messages: CachedChatMessage[],
  targetName: string,
  signals: DeterministicSignals
): PersonaAnalysis {
  const targetMessages = messages.filter((message) => message.sender === targetName);
  const examples = targetMessages
    .map((message) => message.content.trim())
    .filter(Boolean)
    .slice(-12);

  return {
    avg_message_length: signals.avg_message_length,
    short_reply_ratio: signals.short_reply_ratio,
    emoji_usage: {
      frequency: signals.emoji_frequency,
      common_emojis: signals.common_emojis,
    },
    tone_style: signals.avg_message_length < 55 ? "kisa ve dogal" : "samimi ve dogal",
    affection_level: inferAffectionLevel(targetMessages.map((message) => message.content)),
    argument_style: "dogrudan",
    common_phrases: signals.common_phrases,
    style_examples: examples,
    response_patterns: {
      tends_to_ask_back: signals.question_ratio > 0.18,
      uses_long_messages: signals.avg_message_length > 140,
      uses_abbreviations: signals.uses_abbreviations,
      sends_multiple_messages: signals.sends_multiple_messages,
    },
    do_not_behaviors: ["Teknik aciklama yapmaz", "Yapay zeka oldugunu soylemez"],
    mood_distribution: {
      casual: 62,
      flirty: signals.common_emojis.length > 2 ? 10 : 4,
      moody: 8,
      argumentative: 4,
      soft: 26,
    },
    signature_openings: signals.signature_openings,
    language_mix: signals.language_mix,
  };
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100;
}

function extractCommonEmojis(contents: string[]): string[] {
  const counts = new Map<string, number>();
  const emojiPattern = /\p{Emoji_Presentation}/gu;
  for (const content of contents) {
    for (const match of content.matchAll(emojiPattern)) {
      const emoji = match[0];
      counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([emoji]) => emoji)
    .slice(0, 5);
}

function extractCommonPhrases(contents: string[]): string[] {
  const counts = new Map<string, number>();
  for (const content of contents) {
    const words = normalizeWords(content);
    for (const word of words) {
      if (word.length < 3) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    for (let index = 0; index < words.length - 1; index += 1) {
      const phrase = `${words[index]} ${words[index + 1]}`;
      if (phrase.length < 7) continue;
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase)
    .slice(0, 12);
}

function extractSignatureOpenings(contents: string[]): string[] {
  const counts = new Map<string, number>();
  for (const content of contents) {
    const opening = normalizeWords(content).slice(0, 3).join(" ");
    if (opening.length < 2) continue;
    counts.set(opening, (counts.get(opening) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([opening]) => opening)
    .slice(0, 3);
}

function normalizeWords(content: string): string[] {
  return content
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function getEmojiFrequency(
  commonEmojiCount: number,
  messageCount: number
): PersonaAnalysis["emoji_usage"]["frequency"] {
  if (commonEmojiCount === 0) return "never";
  const ratio = commonEmojiCount / Math.max(1, messageCount);
  if (ratio < 0.02) return "rare";
  if (ratio < 0.08) return "moderate";
  return "frequent";
}

function detectLanguageMix(contents: string[]): PersonaAnalysis["language_mix"] {
  const joined = contents.join(" ").toLocaleLowerCase("tr-TR");
  const turkishHits = (joined.match(/[çğıöşü]/g) ?? []).length;
  const englishHits = (joined.match(/\b(the|and|you|are|what|why|love|ok|yes|no)\b/g) ?? [])
    .length;
  if (englishHits > turkishHits * 2 && turkishHits < 3) return "mostly_english";
  if (englishHits > 8 && turkishHits > 2) return "mixed";
  return "mostly_turkish";
}

function detectAbbreviations(contents: string[]): boolean {
  const joined = contents.join(" ").toLocaleLowerCase("tr-TR");
  return /\b(slm|nbr|tm|tmm|ok|evt|yrn|cnm|askm|knk|kanka)\b/u.test(joined);
}

function inferAffectionLevel(contents: string[]): number {
  const joined = contents.join(" ").toLocaleLowerCase("tr-TR");
  const hits = (joined.match(/\b(canım|askım|aşkım|seviyorum|özledim|kalbim|tatlım)\b/gu) ?? [])
    .length;
  return Math.min(10, Math.max(3, 3 + hits));
}
