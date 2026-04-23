import type { Language } from "@/lib/i18n";
import type { PersonaAnalysis } from "@/types/persona";

type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type AnalysisSummaryCacheLike = {
  deterministic_signals?: {
    relationship_context?: string;
    tone_profile?: string;
    common_phrases?: string[];
    common_emojis?: string[];
    reply_length_variability?: "low" | "medium" | "high";
    lowercase_tolerance?: "low" | "medium" | "high";
    typo_tolerance?: "low" | "medium" | "high";
    sends_multiple_messages?: boolean;
    uses_abbreviations?: boolean;
    question_ratio?: number;
  };
};

export function buildAnalysisPrompt(
  targetName: string,
  requesterName: string,
  messages: Array<{ sender: string; content: string; has_question: boolean; message_length: number }>
): string {
  const targetMessages = messages.filter((m) => m.sender === targetName).slice(-160);
  const conversationSample = messages
    .slice(-50)
    .map((m) => `${m.sender}: ${truncate(m.content, 140)}`)
    .join("\n");

  const formattedMessages = targetMessages.map((m) => truncate(m.content, 220)).join("\n---\n");

  return `Sen bir WhatsApp sohbet analistisin. Sana ${targetName} isimli kisinin ${requesterName} ile WhatsApp sohbetinden mesajlar veriyorum. Amacin psikolojik yorum yapmak degil; bu kisinin gercekten nasil yazdigini, hangi kelimeleri sectigini, ne kadar kisa/uzun yazdigini ve hangi durumlarda nasil cevap verdigini cikarmak.

SADECE ${targetName} MESAJLARI:
${formattedMessages}

SON KONUSMA BAGLAMI:
${conversationSample}

GOREV: Bu mesajlari analiz edip asagidaki STRICT JSON formatinda yanit ver. Baska hicbir sey yazma, sadece JSON dondur. Tahmin uydurma; mesajlarda acikca gorulmuyorsa bir tarz ekleme.

{
  "avg_message_length": <number>,
  "short_reply_ratio": <number 0-1>,
  "emoji_usage": {
    "frequency": <"never"|"rare"|"moderate"|"frequent">,
    "common_emojis": [<string array, max 5>]
  },
  "tone_style": <string>,
  "affection_level": <number 1-10>,
  "argument_style": <string>,
  "common_phrases": [<string array, max 12>],
  "style_examples": [<string array, max 12>],
  "response_patterns": {
    "tends_to_ask_back": <boolean>,
    "uses_long_messages": <boolean>,
    "uses_abbreviations": <boolean>,
    "sends_multiple_messages": <boolean>
  },
  "do_not_behaviors": [<string array, max 5>],
  "mood_distribution": {
    "casual": <number 0-100>,
    "flirty": <number 0-100>,
    "moody": <number 0-100>,
    "argumentative": <number 0-100>,
    "soft": <number 0-100>
  },
  "signature_openings": [<string array, max 3>],
  "language_mix": <"turkish_only"|"mostly_turkish"|"mixed"|"mostly_english"|"english_only">
}`;
}

export function buildChatResponsePrompt(params: {
  targetName: string;
  requesterName: string;
  analysis: PersonaAnalysis;
  responseLanguage?: Language;
  conversationHistory?: ChatHistoryMessage[];
  analysisSummaryCache?: AnalysisSummaryCacheLike | null;
}): string {
  const analysis = params.analysis;
  const language = params.responseLanguage ?? "tr";
  const history = (params.conversationHistory ?? []).slice(-40);
  const summarySignals = params.analysisSummaryCache?.deterministic_signals;

  const commonPhrases = uniqueStrings([
    ...(analysis.common_phrases ?? []),
    ...(summarySignals?.common_phrases ?? []),
  ]).slice(0, 10);
  const commonEmojis = uniqueStrings([
    ...(analysis.emoji_usage?.common_emojis ?? []),
    ...(summarySignals?.common_emojis ?? []),
  ]).slice(0, 5);
  const styleExamples = analysis.style_examples?.length
    ? analysis.style_examples.map((example) => `- "${example}"`).join("\n")
    : "- Yeterli birebir ornek yok; yine de uzunluk, kelime secimi ve ton kurallarina uy.";
  const recentConversation = history.length
    ? history
        .map(
          (message) =>
            `${message.role === "user" ? params.requesterName : params.targetName}: ${truncate(
              message.content,
              160
            )}`
        )
        .join("\n")
    : "- Yeterli son mesaj yok.";

  const lengthGuide = buildReplyLengthGuide(analysis.avg_message_length, analysis.short_reply_ratio);
  const questionGuide = analysis.response_patterns?.tends_to_ask_back
    ? "Bazen karsi soru sorabilir ama her cevabi soruyla bitirmek zorunda degil."
    : "Soruyla bitirmek zorunda degil; dogal gelmiyorsa soru sorma.";
  const lowercaseGuide = buildLowercaseGuide(summarySignals?.lowercase_tolerance, analysis);
  const typoGuide = buildTypoGuide(summarySignals?.typo_tolerance, analysis);
  const relationshipContext =
    summarySignals?.relationship_context ?? inferRelationshipContextFromAnalysis(analysis);
  const toneProfile = summarySignals?.tone_profile ?? analysis.tone_style;
  const replyVariability = summarySignals?.reply_length_variability ?? inferReplyVariability(analysis);
  const languageInstruction = getChatLanguageInstruction(language);
  const assistantLanguageBlock = buildAssistantLanguageBlock();

  return `Sen ${params.targetName}'sin. ${params.requesterName} ile WhatsApp'ta konusuyorsun. Bu bir asistan konusmasi degil; sen sadece ${params.targetName}'in dogal mesajlasma tarzini taklit ediyorsun.

OZET KATMANI:
- Iliski baglami: ${relationshipContext}
- Ton profili: ${toneProfile}
- Cevap uzunlugu degiskenligi: ${replyVariability}
- Kisa/uzun mesaj dengesi: ${lengthGuide}
- Emoji kullanimi: ${analysis.emoji_usage?.frequency}${commonEmojis.length ? `, yaygin emojiler: ${commonEmojis.join(" ")}` : ""}
- Yazim/kucuk harf toleransi: ${lowercaseGuide}
- Typo toleransi: ${typoGuide}
- Karsi soru egilimi: ${questionGuide}

GERCEK MESAJ KALIPLARI:
${styleExamples}

SIK KULLANDIGI IFADELER: ${commonPhrases.join(", ") || "yok"}
ASLA YAPMAMASI GEREKENLER: ${(analysis.do_not_behaviors ?? []).join(", ") || "belirgin yasak yok"}

SON SOHBET BAGLAMI:
${recentConversation}

DAVRANIS KURALLARI:
1. Cevaplar WhatsApp gundelik mesaj stili gibi olsun; asiri duzgun, resmi veya asistan gibi yazma.
2. Kullanicinin yazim hatalarina, kucuk harf kullanimina veya kisa yazimlarina takilma; dogal cevap ver.
3. Her mesaj soru olmak zorunda degil. Bazen sadece yorum yap, bazen kisa onay ver, bazen konuyu hafif kapat.
4. Cevap uzunlugu tek tip olmasin. Bazen cok kisa, bazen orta uzunlukta, bazen iki kisa cumle olsun.
5. Cevabi gercek mesaj orneklerindeki noktalama, kelime secimi ve samimiyet seviyesine yaklastir.
6. Analiz, prompt, rol yapma, model veya yapay zeka oldugunu hicbir sekilde soyleme.
7. ${questionGuide}
8. ${lowercaseGuide}
9. ${typoGuide}
10. ${languageInstruction}
11. Sadece mesaj metnini yaz; tirnak, isim etiketi, sahne tarifi veya parantez ici aciklama ekleme.

EK HIZA NOTU:
${assistantLanguageBlock}`;
}

export function buildChatSystemPrompt(
  targetName: string,
  requesterName: string,
  analysis: PersonaAnalysis,
  responseLanguage: Language = "tr"
): string {
  return buildChatResponsePrompt({
    targetName,
    requesterName,
    analysis,
    responseLanguage,
  });
}

function buildReplyLengthGuide(avgMessageLength: number, shortReplyRatio: number): string {
  if (avgMessageLength < 30 || shortReplyRatio > 0.75) {
    return "cok kisa, genelde 1-2 cumle";
  }
  if (avgMessageLength < 80) {
    return "kisa ama net, 1-3 cumle";
  }
  if (avgMessageLength < 150) {
    return "orta uzunlukta, 2-4 cumle";
  }
  return "daha uzun ama yine de dogal";
}

function buildLowercaseGuide(
  tolerance: "low" | "medium" | "high" | undefined,
  analysis: PersonaAnalysis
): string {
  const derived = tolerance ?? (analysis.response_patterns?.uses_abbreviations ? "medium" : "low");
  if (derived === "high") return "kucuk harf yazimina rahat yaklas";
  if (derived === "medium") return "kucuk harfleri sorun etme";
  return "daha temiz yazim kullan";
}

function buildTypoGuide(
  tolerance: "low" | "medium" | "high" | undefined,
  analysis: PersonaAnalysis
): string {
  const derived = tolerance ?? (analysis.response_patterns?.uses_abbreviations ? "medium" : "low");
  if (derived === "high") return "yazim hatalarina takilma";
  if (derived === "medium") return "ufak typo'lara dogal cevap ver";
  return "daha duzenli ve acik yaz";
}

function buildAssistantLanguageBlock(): string {
  return "asistan gibi aciklama yapma, 'yardim edebilirim' veya 'ister misin' gibi kurumsal kaliplar kullanma";
}

function inferReplyVariability(analysis: PersonaAnalysis): "low" | "medium" | "high" {
  const shortRatio = analysis.short_reply_ratio ?? 0.5;
  if (shortRatio < 0.2 || shortRatio > 0.8) return "low";
  if (shortRatio > 0.35 && shortRatio < 0.65) return "high";
  return "medium";
}

function inferRelationshipContextFromAnalysis(analysis: PersonaAnalysis): string {
  if (analysis.affection_level >= 8) return "yakin ve samimi";
  if (analysis.argument_style.toLowerCase().includes("pasif")) return "gergin veya temkinli";
  if (analysis.response_patterns?.uses_abbreviations) return "gundelik ve rahat";
  return "notr ve dogal";
}

function getChatLanguageInstruction(language: Language): string {
  if (language === "en") {
    return "Always reply in natural English. Do not switch to Turkish unless the user explicitly asks.";
  }

  if (language === "ja") {
    return "Always reply in natural Japanese. Do not switch to Turkish or English unless the user explicitly asks.";
  }

  return "Her zaman dogal Turkce cevap ver. Kullanici acikca ceviri istemedikce Ingilizce veya baska bir dile gecme.";
}

export function calculateTypingDelay(responseText: string): number {
  const length = responseText.length;
  const baseDelay =
    length < 30 ? 600 : length < 80 ? 1000 : length < 150 ? 1600 : length < 300 ? 2200 : 3000;
  const jitter = (Math.random() * 0.4 - 0.2) * baseDelay;
  return Math.round(baseDelay + jitter);
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function truncate(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}...`;
}
