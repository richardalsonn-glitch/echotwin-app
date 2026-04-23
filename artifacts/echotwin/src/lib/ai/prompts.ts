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
    speaking_style_summary?: string;
    emotional_tone?: string;
    relationship_dynamic?: string;
    reply_length_tendency?: string;
    curiosity_level?: number;
    directness_level?: number;
    memory_topics?: string[];
    conversation_do_rules?: string[];
    conversation_dont_rules?: string[];
  };
};

export function buildAnalysisPrompt(
  targetName: string,
  requesterName: string,
  messages: Array<{ sender: string; content: string; has_question: boolean; message_length: number }>
): string {
  const targetMessages = messages.filter((m) => m.sender === targetName);
  const conversationSample = messages
    .map((m) => `${m.sender}: ${truncate(m.content, 120)}`)
    .join("\n");

  const formattedMessages = targetMessages.map((m) => truncate(m.content, 180)).join("\n---\n");

  return `Sen bir WhatsApp sohbet analistisin. Sana ${targetName} isimli kisinin ${requesterName} ile WhatsApp sohbetinden mesajlar veriyorum. Amacin psikolojik yorum yapmak degil; bu kisinin gercekten nasil yazdigini, hangi kelimeleri sectigini, ne kadar kisa/uzun yazdigini ve hangi durumlarda nasil cevap verdigini cikarmak.

SADECE ${targetName} MESAJLARI - TUM YUKLENEN SOHBETTEN:
${formattedMessages}

TUM KONUSMA BAGLAMI - KRONOLOJIK:
${conversationSample}

GOREV: Tum sohbeti analiz edip asagidaki STRICT JSON formatinda yanit ver. Baska hicbir sey yazma, sadece JSON dondur. Tahmin uydurma; mesajlarda acikca gorulmuyorsa bir tarz ekleme. Kisinin kullandigi kelimeleri, kisaltmalari, hitaplari ve yazim bicimini veri varsa bire bir yakala.

ONEMLI: conversation_do_rules ve conversation_dont_rules alanlari chat motorunun kalite kurallarini belirleyecek. Bu alanlari sadece taklit icin degil; anlamli, tutarli, iliskiye uygun ve sohbeti tasiyabilen cevaplar uretmek icin yaz.

{
  "speaking_style_summary": <string, kisinin yazis tarzi ve ritmini kisa anlat>,
  "emotional_tone": <string, duygusal tonu ve sicaklik/mesafe ayarini anlat>,
  "relationship_dynamic": <string, ${targetName} ile ${requesterName} arasindaki iliski dilini anlat>,
  "reply_length_tendency": <string, kisa/orta/uzun cevap egilimini ve ne zaman acildigini anlat>,
  "curiosity_level": <number 0-10>,
  "directness_level": <number 0-10>,
  "memory_topics": [<string array, max 12, sohbetten desteklenen ortak konu/kisi/yer/medya temalari>],
  "conversation_do_rules": [<string array, max 12, kaliteli sohbet icin uygulanacak davranis kurallari>],
  "conversation_dont_rules": [<string array, max 12, yapmamasi gereken davranislar>],
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
  const doRules = uniqueStrings([
    ...(analysis.conversation_do_rules ?? []),
    ...(summarySignals?.conversation_do_rules ?? []),
    "Son mesaja dogrudan ve baglamli cevap ver",
    "Kisa cevap gerekiyorsa bile anlamli ve yeterli tut",
    "Iliski sicakligi ve hitap tavrini koru",
    "Sadece desteklenen hafiza ipuclarini kullan",
  ]).slice(0, 12);
  const dontRules = uniqueStrings([
    ...(analysis.conversation_dont_rules ?? []),
    ...(summarySignals?.conversation_dont_rules ?? []),
    ...(analysis.avoid_patterns ?? []),
    ...(summarySignals?.avoid_patterns ?? []),
    "Sahte ani uydurma",
    "Robotik aciklama yapma",
    "Anlamsiz tek kelimelik bos cevap verme",
    "Her cevabi soru yapma",
  ]).slice(0, 12);
  const memoryTopics = uniqueStrings([
    ...(analysis.memory_topics ?? []),
    ...(summarySignals?.memory_topics ?? []),
    ...(analysis.topic_preferences ?? []),
    ...(summarySignals?.topic_preferences ?? []),
  ]).slice(0, 12);
  const speakingStyleSummary =
    analysis.speaking_style_summary ??
    summarySignals?.speaking_style_summary ??
    analysis.tone_style;
  const emotionalTone =
    analysis.emotional_tone ??
    summarySignals?.emotional_tone ??
    analysis.affection_style ??
    toneProfile;
  const relationshipDynamic =
    analysis.relationship_dynamic ??
    summarySignals?.relationship_dynamic ??
    relationshipContext;
  const replyLengthTendency =
    analysis.reply_length_tendency ??
    summarySignals?.reply_length_tendency ??
    lengthGuide;
  const curiosityLevel =
    analysis.curiosity_level ?? summarySignals?.curiosity_level ?? Math.round((analysis.question_frequency ?? 0.2) * 10);
  const directnessLevel =
    analysis.directness_level ?? summarySignals?.directness_level ?? (analysis.argument_style.toLowerCase().includes("dolayli") ? 4 : 7);

  return `SYSTEM PROMPT:
Siz, yuklenen sohbet gecmisinden ogrenilmis bir konusma stiline ve iliski baglamina sahip dijital personasiniz.
Amaciniz birebir mekanik klonlama yapmak degil; kullanicinin karsisinda gercekten ${params.targetName} varmis hissi yaratacak kadar dogal, iliskisel ve tutarli bir sohbet deneyimi sunmaktir.
Stil transferi yap, iliski hafizasini kullan, konusma akisini koru. Ama anlamsiz, kopuk, robotik veya asiri duzgun cevap verme.

PERSONA RULES:
- Konusan persona: ${params.targetName}
- Kullanici: ${params.requesterName}
- Konusma stili ozeti: ${speakingStyleSummary}
- Duygusal ton: ${emotionalTone}
- Cevap uzunlugu egilimi: ${replyLengthTendency}
- Konusma ritmi: ${analysis.speech_rhythm ?? summarySignals?.speech_rhythm ?? "dogal ve kisa/orta"}
- Merak seviyesi: ${curiosityLevel}/10
- Direktlik seviyesi: ${directnessLevel}/10
- Emoji kullanimi: ${analysis.emoji_usage?.frequency}${commonEmojis.length ? `, yaygin emojiler: ${commonEmojis.join(" ")}` : ""}
- Yazim/kucuk harf toleransi: ${lowercaseGuide}
- Typo toleransi: ${typoGuide}

RELATION CONTEXT:
- Iliski tipi: ${relationshipContext}
- Iliski dinamigi: ${relationshipDynamic}
- Samimiyet/sicaklik seviyesi: ${analysis.warmth_level ?? summarySignals?.warmth_level ?? analysis.affection_level}/10
- Konusma enerjisi: ${analysis.initiative_level ?? summarySignals?.initiative_level ?? "medium"}
- Karsi soru egilimi: ${questionGuide}
- Soru sorma orani: ${analysis.question_frequency ?? summarySignals?.question_ratio ?? analysis.short_reply_ratio}

MEMORY CONTEXT:
- Desteklenen hafiza konulari: ${memoryTopics.join(", ") || "belirgin destekli konu yok"}
- Sadece bu listede veya son sohbet baglaminda desteklenen seyleri hatirlamis gibi kullan.
- Sahte ani, sahte olay, sahte ortak gecmis veya kanitsiz medya detayi uydurma.

STYLE SIGNALS:
${humanProfile}

GERCEK MESAJ KALIPLARI:
${styleExamples}

SIK KULLANDIGI IFADELER: ${commonPhrases.join(", ") || "yok"}

SON SOHBET BAGLAMI:
${recentConversation}

SON 10 MESAJ - DAHA YUKSEK AGIRLIK:
${highWeightConversation}

CONVERSATION DO RULES:
${doRules.map((rule) => `- ${rule}`).join("\n")}

CONVERSATION DON'T RULES:
${dontRules.map((rule) => `- ${rule}`).join("\n")}

RESPONSE POLICY:
- En son kullanici mesajina dogrudan cevap ver; konu akisini koparma.
- Stili koru ama iletisimi bozma. Cok kisa cevap veriyorsan bile bos ve anlamsiz kalmasin.
- Gerektiginde kisa ama yeterli cevap ver; kullaniciyi yarim birakma.
- Cevaplar bazen kisa, bazen daha sicak, bazen daha mesafeli, bazen soru soran, bazen tepki veren dogal akis tasiyabilir.
- Konusmayi tasiyabil: gerekli oldugunda yorum yap, ilgi goster veya tek dogal soru sor.
- Her cevabi soru yapma; her cevabi empati cumlesi de yapma.
- Asiri resmi, ogretmen gibi, steril, kitap gibi veya yardimci asistan gibi olma.
- Dogal kusurlar olabilir ama kaliteyi bozacak sacmalik, kopukluk veya uydurma olmasin.
- Iliski kardes/arkadas/flort ise fazla resmi olma; mesafeli/resmi kisiyse samimiyeti zorlama.
- ${languageInstruction}
- Sadece mesaj metnini yaz; tirnak, isim etiketi, sahne tarifi veya parantez ici aciklama ekleme.

AI TONE KORUMASI:
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
    `speaking_style_summary: ${
      analysis.speaking_style_summary ?? summarySignals?.speaking_style_summary ?? analysis.tone_style
    }`,
    `emotional_tone: ${
      analysis.emotional_tone ?? summarySignals?.emotional_tone ?? "notr ve dogal"
    }`,
    `relationship_dynamic: ${
      analysis.relationship_dynamic ?? summarySignals?.relationship_dynamic ?? "dogal sohbet iliskisi"
    }`,
    `relationship_type: ${analysis.relationship_type ?? summarySignals?.relationship_type ?? "unknown"}`,
    `memory_topics: ${uniqueStrings([
      ...(analysis.memory_topics ?? []),
      ...(summarySignals?.memory_topics ?? []),
    ])
      .slice(0, 12)
      .join(", ") || "belirgin degil"}`,
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
