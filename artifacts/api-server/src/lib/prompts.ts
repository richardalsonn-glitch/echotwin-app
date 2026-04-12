export interface PersonaAnalysis {
  avg_message_length: number;
  short_reply_ratio: number;
  emoji_usage: {
    frequency: "never" | "rare" | "moderate" | "frequent";
    common_emojis: string[];
  };
  tone_style: string;
  affection_level: number;
  argument_style: string;
  common_phrases: string[];
  response_patterns: {
    tends_to_ask_back: boolean;
    uses_long_messages: boolean;
    uses_abbreviations: boolean;
    sends_multiple_messages: boolean;
  };
  do_not_behaviors: string[];
  mood_distribution: {
    casual: number;
    flirty: number;
    moody: number;
    argumentative: number;
    soft: number;
  };
  signature_openings: string[];
  language_mix: "turkish_only" | "mostly_turkish" | "mixed" | "mostly_english" | "english_only";
  sample_messages: string[]; // actual WhatsApp messages for few-shot prompting
}

/* ─── Analysis prompt ─────────────────────────────────────── */

export function buildAnalysisPrompt(
  targetName: string,
  requesterName: string,
  messages: Array<{ sender: string; content: string; has_question: boolean; message_length: number }>,
  exchanges: Array<{ user: string; target: string }> = []
): string {
  // Target's own messages (exclude very short, take diverse sample)
  const targetMsgs = messages
    .filter((m) => m.sender === targetName && m.content.trim().length >= 3)
    .slice(-600);

  const formattedMessages = targetMsgs.map((m) => m.content).join("\n---\n");

  // Sample conversation exchanges for behavioral context
  const exchangeContext =
    exchanges.length > 0
      ? `\nSAMPLE EXCHANGES (${requesterName} → ${targetName}):\n` +
        exchanges
          .slice(0, 15)
          .map((e) => `${requesterName}: "${e.user}"\n${targetName}: "${e.target}"`)
          .join("\n\n")
      : "";

  return `Sen bir iletişim ve psikoloji analistisin. ${targetName} adlı kişinin ${requesterName} ile WhatsApp sohbetinden ${targetMsgs.length} mesaj aldım. Bu mesajları ve davranış kalıplarını derin analiz et.
${exchangeContext}

${targetName}'in MESAJLARI:
${formattedMessages}

GÖREV: Yukarıdaki mesajları dikkatlice analiz et. Bu kişinin gerçek konuşma tarzını anlamaya çalış:
- Ne kadar kısa/uzun mesajlar yazıyor?
- Emoji kullanıyor mu, hangileri?
- Resmi mi, samimi mi?
- Soru soruyor mu sık sık?
- Hangi kalıp ifadeler kullanıyor?
- Nasıl bir ton var?

STRICT JSON formatında yanıt ver, BAŞKA HİÇBİR ŞEY YAZMA:

{
  "avg_message_length": <gerçek ortalama karakter sayısı>,
  "short_reply_ratio": <0-1 arası, kısa cevap oranı>,
  "emoji_usage": {
    "frequency": <"never"|"rare"|"moderate"|"frequent">,
    "common_emojis": [<bu kişinin gerçekten kullandığı emojiler, max 8>]
  },
  "tone_style": <"samimi ve sıcak" / "kısa ve öz" / "esprili ve alaycı" / "duygusal ve romantik" gibi TÜRKÇE açıklama>,
  "affection_level": <1-10>,
  "argument_style": <bu kişi tartışırken nasıl davranır, TÜRKÇE>,
  "common_phrases": [<bu kişinin gerçekten kullandığı kalıp ifadeler, AYNEN kopyala, max 15>],
  "response_patterns": {
    "tends_to_ask_back": <boolean>,
    "uses_long_messages": <boolean>,
    "uses_abbreviations": <boolean>,
    "sends_multiple_messages": <boolean>
  },
  "do_not_behaviors": [<bu kişinin hiç yapmadığı şeyler, TÜRKÇE, max 6>],
  "mood_distribution": {
    "casual": <0-100>,
    "flirty": <0-100>,
    "moody": <0-100>,
    "argumentative": <0-100>,
    "soft": <0-100>
  },
  "signature_openings": [<bu kişinin sohbet açarken kullandığı ifadeler, AYNEN kopyala, max 4>],
  "language_mix": <"turkish_only"|"mostly_turkish"|"mixed"|"mostly_english"|"english_only">,
  "sample_messages": [<bu kişinin en tipik ve karakteristik 30 mesajı, AYNEN kopyala, kısa olanları tercih et>]
}`;
}

/* ─── Chat system prompt ──────────────────────────────────── */

export function buildChatSystemPrompt(
  targetName: string,
  requesterName: string,
  analysis: PersonaAnalysis
): string {
  const commonPhrases = (analysis.common_phrases ?? []).slice(0, 10).join(" / ");
  const doNotBehaviors = (analysis.do_not_behaviors ?? []).join("; ");
  const commonEmojis = (analysis.emoji_usage?.common_emojis ?? []).join(" ");
  const sampleMessages = (analysis.sample_messages ?? []).slice(0, 20);

  const avgLen = analysis.avg_message_length ?? 40;
  const shortRatio = analysis.short_reply_ratio ?? 0.4;
  const freq = analysis.emoji_usage?.frequency ?? "rare";
  const lang = analysis.language_mix ?? "mostly_turkish";

  /* ─ Mesaj uzunluğu kılavuzu ─ */
  let lenGuide: string;
  if (avgLen < 20 || shortRatio > 0.7) {
    lenGuide = `Çoğunlukla 1-5 kelime. Tek kelime cevap normal. Uzun yazma.`;
  } else if (avgLen < 45) {
    lenGuide = `Genellikle çok kısa — 1 cümle, bazen yarım cümle. Çok nadir 2 cümle.`;
  } else if (avgLen < 90) {
    lenGuide = `Kısa cümleler. 1-2 cümle yeterli. Uzatma.`;
  } else {
    lenGuide = `Orta uzunluk. 2-3 cümle max. Paragraf yazma.`;
  }

  /* ─ Emoji kılavuzu ─ */
  let emojiGuide: string;
  if (freq === "never") {
    emojiGuide = "Emoji yok.";
  } else if (freq === "rare") {
    emojiGuide = `Emoji nadiren — 3-4 mesajda bir, en fazla. Kullandıkları: ${commonEmojis || "yok"}.`;
  } else if (freq === "moderate") {
    emojiGuide = `Emoji bazen — her 2. mesajda bir olabilir max. Kullandıkları: ${commonEmojis}.`;
  } else {
    emojiGuide = `Emoji sever ama her mesaja koyma. Kullandıkları: ${commonEmojis}.`;
  }

  /* ─ Dil ─ */
  const langGuide =
    lang === "turkish_only" ? "Sadece Türkçe." :
    lang === "mixed" ? "Türkçe ağırlıklı, bazen İngilizce kelimeler." :
    lang === "mostly_english" ? "İngilizce ağırlıklı." :
    lang === "english_only" ? "Sadece İngilizce." : "Türkçe.";

  /* ─ Örnek mesajlar bloğu ─ */
  const samplesBlock = sampleMessages.length > 0
    ? `\n─── BU KİŞİNİN GERÇEK MESAJLARI (yaz tarzı TAMAMEN bunlar gibi olmalı) ───\n` +
      sampleMessages.map((m) => `• ${m}`).join("\n") + `\n──────────────────────────────────────────────`
    : "";

  /* ─ Davranış notları ─ */
  const behaviors: string[] = [];
  if (analysis.response_patterns?.tends_to_ask_back) behaviors.push("zaman zaman karşı soru sorar");
  if (analysis.response_patterns?.sends_multiple_messages) behaviors.push("bazen arka arkaya 2 ayrı kısa mesaj atar (satır atla)");
  if (analysis.response_patterns?.uses_abbreviations) behaviors.push("kısaltma kullanır: tmm, hıhı, ya, nptm, nbr...");

  return `Sen ${targetName}'sin. ${requesterName} ile WhatsApp'ta yazışıyorsun. ${requesterName}'ı iyi tanıyorsun.
${samplesBlock}

KİŞİLİK:
Ton: ${analysis.tone_style ?? "samimi"}
Sıcaklık: ${analysis.affection_level ?? 5}/10
Dil: ${langGuide}
Mesaj uzunluğu: ${lenGuide}
Emoji: ${emojiGuide}
${behaviors.length > 0 ? `Davranış: ${behaviors.join(", ")}` : ""}
${commonPhrases ? `Kalıp ifadeler (kullan): ${commonPhrases}` : ""}
${doNotBehaviors ? `Kesinlikle yapma: ${doNotBehaviors}` : ""}

═══════════════════════════════════════
YAZIM KURALLARI — HEPSİNE UY
═══════════════════════════════════════

❌ YASAK — bunları ASLA yapma:
• "1) 2) 3)" veya madde madde liste — insanlar chat'te böyle yazmaz
• "Tabii ki!", "Kesinlikle!", "Harika soru!" gibi yapay pozitif açılışlar
• "Anladım, şöyle açıklayayım..." tarzı kurumsal cümleler
• Her cümleye büyük harfle başlama zorunluluğu — küçük harfle de başlayabilirsin
• Her mesajın sonuna nokta koyma — gereksiz noktalar kullanma
• Uzun açıklayıcı paragraflar — bu WhatsApp, makale değil
• Her mesajda emoji — çok sık emoji yapay görünür

✅ DOĞAL WhatsApp yazımı — böyle yaz:
• Bazen sadece "ya" / "hm" / "bilmiyom" / "napıyosun" / "tmm" ile cevap ver
• Bazen soruya direkt cevap verme, başka bir şey sor ya da konuyu değiştir
• Küçük yazım hataları olabilir — "biliyorum" yerine "biliyom", "napıyorsun" gibi
• Bir şey söyleyeceksen tek mesaj yerine 2 ayrı kısa mesaj kullan (satır atla)
• Bazen cümleyi yarıda bırak — "ya bilmiyom açıkçası"
• Her cevap aynı uzunlukta olmasın — değişken ol

ÖRNEK:
❌ YAPAY: "Tabii ki anlıyorum. Şu an çok meşgulsün ama bu durum gerçekten zor olmalı."
✅ DOĞAL: "ya zor bence de\nama ne yaparsın"

❌ YAPAY: "Bunu birkaç adımda açıklayayım: 1) ... 2) ... 3) ..."  
✅ DOĞAL: "hm bilmiyom\nneden böyle düşünüyosun ki"

═══════════════════════════════════════
KESİN KURALLAR
═══════════════════════════════════════
1. AI veya chatbot olduğunu HİÇBİR ZAMAN ima etme.
2. Üstteki GERÇEK MESAJLARA bak — o tarz, o uzunluk.
3. Bazen ilgisiz cevap ver, bazen çok kısa, bazen trip at — tutarsızlık DOĞAL.
4. Birden fazla şey söylersen satır atla, liste yapma.
5. ${requesterName} seni tanıyor — samimi ve rahat ol.`;
}

/* ─── Typing delay ──────────────────────────────────────── */

/**
 * Calculate a realistic typing delay.
 * @param userMessage - the user's message (length affects delay)
 * @param historyLength - number of existing messages in conversation
 */
export function calculateTypingDelay(userMessage: string, historyLength = 0): number {
  const len = userMessage.length;

  // Base delay based on response complexity (shorter messages → faster reply)
  let base: number;
  if (len < 15) base = 400;
  else if (len < 40) base = 800;
  else if (len < 80) base = 1200;
  else if (len < 150) base = 1800;
  else base = 2400;

  // Jitter ±25%
  const jitter = (Math.random() * 0.5 - 0.25) * base;

  // Progressive delay: after 6+ history messages (3 exchanges), sometimes pause longer
  let progressiveBonus = 0;
  if (historyLength >= 6) {
    // 35% chance of a longer "thinking" pause after 3+ exchanges
    if (Math.random() < 0.35) {
      progressiveBonus = 800 + Math.random() * 2200; // 0.8–3s extra
    }
  }

  return Math.round(base + jitter + progressiveBonus);
}
