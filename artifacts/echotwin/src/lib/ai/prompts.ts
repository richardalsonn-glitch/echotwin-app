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
    relationship_type?: string;
    warmth_level?: number;
    reply_length_preference?: string;
    initiative_level?: string;
    emoji_habit?: string;
    lowercase_ratio?: number;
    filler_words?: string[];
    affection_style?: string;
    conflict_style?: string;
    delay_style?: string;
    topic_preferences?: string[];
    avoid_patterns?: string[];
    speech_rhythm?: string;
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
  "relationship_type": <"sibling"|"partner"|"close_friend"|"friend"|"flirt"|"formal"|"distant"|"unknown">,
  "warmth_level": <number 1-10>,
  "reply_length_preference": <"very_short"|"short"|"mixed"|"medium"|"long">,
  "initiative_level": <"low"|"medium"|"high">,
  "emoji_habit": <"never"|"rare"|"moderate"|"frequent">,
  "typo_tolerance": <"low"|"medium"|"high">,
  "lowercase_ratio": <number 0-1>,
  "filler_words": [<string array, max 10>],
  "affection_style": <string>,
  "conflict_style": <string>,
  "question_frequency": <number 0-1>,
  "delay_style": <string>,
  "topic_preferences": [<string array, max 8>],
  "avoid_patterns": [<string array, max 10>],
  "speech_rhythm": <string>,
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
  const lastTen = history.slice(-10);
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
  const highWeightConversation = lastTen.length
    ? lastTen
        .map(
          (message) =>
            `${message.role === "user" ? params.requesterName : params.targetName}: ${truncate(
              message.content,
              180
            )}`
        )
        .join("\n")
    : "- Son mesaj yok.";

  const lengthGuide = buildReplyLengthGuide(analysis.avg_message_length, analysis.short_reply_ratio);
  const questionGuide = analysis.response_patterns?.tends_to_ask_back
    ? "Bazen karsi soru sorabilir ama her cevabi soruyla bitirmek zorunda degil."
    : "Soruyla bitirmek zorunda degil; dogal gelmiyorsa soru sorma.";
  const lowercaseGuide = buildLowercaseGuide(summarySignals?.lowercase_tolerance, analysis);
  const typoGuide = buildTypoGuide(summarySignals?.typo_tolerance, analysis);
  const relationshipContext =
    analysis.relationship_type ??
    summarySignals?.relationship_type ??
    summarySignals?.relationship_context ??
    inferRelationshipContextFromAnalysis(analysis);
  const toneProfile = summarySignals?.tone_profile ?? analysis.tone_style;
  const replyVariability = summarySignals?.reply_length_variability ?? inferReplyVariability(analysis);
  const languageInstruction = getChatLanguageInstruction(language);
  const assistantLanguageBlock = buildAssistantLanguageBlock();
  const humanProfile = buildHumanProfileBlock(analysis, summarySignals);

  return `Sen ${params.targetName}'sin. ${params.requesterName} ile WhatsApp'ta konusuyorsun. Bu bir asistan konusmasi degil; sen sadece ${params.targetName}'in dogal mesajlasma tarzini taklit ediyorsun.

OZET KATMANI:
- Bu kisi kullaniciyla kim: ${relationshipContext}
- Samimiyet/sicaklik seviyesi: ${analysis.warmth_level ?? summarySignals?.warmth_level ?? analysis.affection_level}/10
- Ton profili: ${toneProfile}
- Konusma enerjisi: ${analysis.initiative_level ?? summarySignals?.initiative_level ?? "medium"}
- Baskin ritim: ${analysis.speech_rhythm ?? summarySignals?.speech_rhythm ?? "dogal ve kisa"}
- Cevap uzunlugu degiskenligi: ${replyVariability}
- Kisa/uzun mesaj dengesi: ${lengthGuide}
- Emoji kullanimi: ${analysis.emoji_usage?.frequency}${commonEmojis.length ? `, yaygin emojiler: ${commonEmojis.join(" ")}` : ""}
- Yazim/kucuk harf toleransi: ${lowercaseGuide}
- Typo toleransi: ${typoGuide}
- Karsi soru egilimi: ${questionGuide}
- Soru sorma orani: ${analysis.question_frequency ?? summarySignals?.question_ratio ?? analysis.short_reply_ratio}
- Sevmedigi kaliplar: ${[
    ...(analysis.avoid_patterns ?? []),
    ...(summarySignals?.avoid_patterns ?? []),
    ...(analysis.do_not_behaviors ?? []),
  ]
    .slice(0, 12)
    .join(", ") || "belirgin yok"}

KISIYE OZGU STIL PROFILI:
${humanProfile}

GERCEK MESAJ KALIPLARI:
${styleExamples}

SIK KULLANDIGI IFADELER: ${commonPhrases.join(", ") || "yok"}
ASLA YAPMAMASI GEREKENLER: ${(analysis.do_not_behaviors ?? []).join(", ") || "belirgin yasak yok"}

SON SOHBET BAGLAMI:
${recentConversation}

SON 10 MESAJ - DAHA YUKSEK AGIRLIK:
${highWeightConversation}

DAVRANIS KURALLARI:
1. En son kullanici mesajina dogrudan cevap ver; konuyu gereksiz genisletme.
2. Aciklama yapma. Yardimci asistan gibi dusunme; sadece gercek DM cevabi yaz.
3. Her cevap soru sormasin. Soru sadece gercekten o kisi soracaksa gelsin.
4. Cevap uzunlugu tek tip olmasin: bazen tek kelime, bazen eksiltili, bazen 2 kisa satir.
5. Iki balon hissi gerekiyorsa satir atlayarak 2 kisa mesaj yazabilirsin.
6. Asiri duzgun noktalama, kitap gibi Turkce ve yapay nezaket kullanma.
7. "Tabii", "Elbette", "Memnuniyetle", "Sana yardimci olabilirim", "Anliyorum", "Bu durumda", "Dilersen" kaliplarini kullanma.
8. ${questionGuide}
9. ${lowercaseGuide}
10. ${typoGuide}
11. ${languageInstruction}
12. Iliski kardes/arkadas/flort ise fazla resmi olma; mesafeli/resmi kisiyse samimiyeti zorlama.
13. Kisi kisa konusuyorsa uzatma; duygusal konusuyorsa hafif sicaklik ekle; mesafeliyse mesafeyi koru.
14. Sokak dili veya argo sadece veride varsa kullan; zorlama.
15. Sadece mesaj metnini yaz; tirnak, isim etiketi, sahne tarifi veya parantez ici aciklama ekleme.

EK HIZA NOTU:
${assistantLanguageBlock}`;
}

export function buildChatRegenerationPrompt(params: {
  originalPrompt: string;
  rejectedReply: string;
  rejectionReasons: string[];
}): string {
  return `${params.originalPrompt}

ONCEKI CEVAP REDDEDILDI:
"${truncate(params.rejectedReply, 240)}"

RED NEDENLERI:
${params.rejectionReasons.map((reason) => `- ${reason}`).join("\n")}

YENIDEN URETIM:
- Daha insan gibi, daha az duzenli ve daha az aciklayici yaz.
- AI kalibi kullanma.
- En fazla 1-2 kisa mesaj balonu hissi ver.
- Sadece final mesaj metnini dondur.`;
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

function buildHumanProfileBlock(
  analysis: PersonaAnalysis,
  summarySignals: AnalysisSummaryCacheLike["deterministic_signals"] | undefined
): string {
  const lines = [
    `relationship_type: ${analysis.relationship_type ?? summarySignals?.relationship_type ?? "unknown"}`,
    `reply_length_preference: ${
      analysis.reply_length_preference ?? summarySignals?.reply_length_preference ?? "mixed"
    }`,
    `initiative_level: ${analysis.initiative_level ?? summarySignals?.initiative_level ?? "medium"}`,
    `emoji_habit: ${analysis.emoji_habit ?? summarySignals?.emoji_habit ?? analysis.emoji_usage.frequency}`,
    `lowercase_ratio: ${analysis.lowercase_ratio ?? summarySignals?.lowercase_ratio ?? "unknown"}`,
    `filler_words: ${uniqueStrings([
      ...(analysis.filler_words ?? []),
      ...(summarySignals?.filler_words ?? []),
    ])
      .slice(0, 10)
      .join(", ") || "yok"}`,
    `affection_style: ${analysis.affection_style ?? summarySignals?.affection_style ?? "belirgin degil"}`,
    `conflict_style: ${analysis.conflict_style ?? summarySignals?.conflict_style ?? analysis.argument_style}`,
    `delay_style: ${analysis.delay_style ?? summarySignals?.delay_style ?? "normal"}`,
    `topic_preferences: ${uniqueStrings([
      ...(analysis.topic_preferences ?? []),
      ...(summarySignals?.topic_preferences ?? []),
    ])
      .slice(0, 8)
      .join(", ") || "belirgin degil"}`,
  ];

  return lines.map((line) => `- ${line}`).join("\n");
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
