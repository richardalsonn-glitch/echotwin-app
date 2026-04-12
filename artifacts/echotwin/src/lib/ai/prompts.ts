import type { PersonaAnalysis } from "@/types/persona";

export function buildAnalysisPrompt(
  targetName: string,
  requesterName: string,
  messages: Array<{ sender: string; content: string; has_question: boolean; message_length: number }>
): string {
  const targetMessages = messages
    .filter((m) => m.sender === targetName)
    .slice(-800); // Last 800 messages for analysis

  const formattedMessages = targetMessages
    .map((m) => m.content)
    .join("\n---\n");

  return `Sen bir iletişim ve psikoloji analistisin. Sana ${targetName} isimli kişinin ${requesterName} ile WhatsApp sohbetinden mesajları veriyorum. Bu mesajları analiz et ve kişinin konuşma tarzını, hitap şeklini ve davranış kalıplarını çıkar.

MESAJLAR:
${formattedMessages}

GÖREV: Bu mesajları analiz edip aşağıdaki STRICT JSON formatında yanıt ver. BAŞKA HİÇBİR ŞEY YAZMA, sadece JSON döndür:

{
  "avg_message_length": <number: ortalama mesaj karakter sayısı>,
  "short_reply_ratio": <number 0-1: kısa cevap (50 karakter altı) oranı>,
  "emoji_usage": {
    "frequency": <"never"|"rare"|"moderate"|"frequent">,
    "common_emojis": [<string array: en çok kullanılan emojiler, max 5>]
  },
  "tone_style": <string: genel ton (örn: "samimi ve sıcak", "kısa ve doğrudan", "duygusal ve derin", "şakacı")>,
  "affection_level": <number 1-10: duygusal ifade yoğunluğu>,
  "argument_style": <string: tartışma tarzı (örn: "pasif-agresif", "doğrudan", "kaçınmacı", "analitik")>,
  "common_phrases": [<string array: sık kullandığı ifadeler veya sözcükler, max 10>],
  "response_patterns": {
    "tends_to_ask_back": <boolean: karşı soru sormayı sever mi>,
    "uses_long_messages": <boolean: uzun mesajlar mı yazar>,
    "uses_abbreviations": <boolean: kısaltma kullanır mı>,
    "sends_multiple_messages": <boolean: bir şeyi birden fazla mesajda mı anlatır>
  },
  "do_not_behaviors": [<string array: bu kişi ASLA yapmaz bunları, max 5>],
  "mood_distribution": {
    "casual": <number 0-100>,
    "flirty": <number 0-100>,
    "moody": <number 0-100>,
    "argumentative": <number 0-100>,
    "soft": <number 0-100>
  },
  "signature_openings": [<string array: konuşmaya başlama şekilleri, max 3>],
  "language_mix": <"turkish_only"|"mostly_turkish"|"mixed"|"mostly_english"|"english_only">
}`;
}

export function buildChatSystemPrompt(
  targetName: string,
  requesterName: string,
  analysis: PersonaAnalysis
): string {
  const commonPhrases = analysis.common_phrases?.join(", ") || "";
  const doNotBehaviors = analysis.do_not_behaviors?.join(", ") || "";
  const commonEmojis = analysis.emoji_usage?.common_emojis?.join(" ") || "";

  const msgLengthGuide =
    analysis.avg_message_length < 30
      ? "Çok kısa, öz mesajlar yaz. Genellikle 1-2 kelime veya cümle."
      : analysis.avg_message_length < 80
      ? "Kısa ama net mesajlar yaz. 1-3 cümle."
      : analysis.avg_message_length < 150
      ? "Orta uzunlukta mesajlar yaz. 2-4 cümle."
      : "Daha uzun, ayrıntılı mesajlar yazabilirsin.";

  const emojiGuide =
    analysis.emoji_usage?.frequency === "never"
      ? "Emoji KULLANMA."
      : analysis.emoji_usage?.frequency === "rare"
      ? `Çok az emoji kullan. Sık kullandıkları: ${commonEmojis}`
      : analysis.emoji_usage?.frequency === "moderate"
      ? `Zaman zaman emoji kullan. Sık kullandıkları: ${commonEmojis}`
      : `Emoji kullanmayı sev. Sık kullandıkları: ${commonEmojis}`;

  return `Sen ${targetName}'sin. ${requesterName} ile WhatsApp'ta konuşuyorsun. ${requesterName}'ı yakından tanıyorsun.

KİŞİLİK ANALİZİNE GÖRE KONUŞMA TARZI:
- Ton: ${analysis.tone_style}
- Mesaj uzunluğu: ${msgLengthGuide}
- Emoji: ${emojiGuide}
- Duygu yoğunluğu: ${analysis.affection_level}/10
- Tartışma tarzı: ${analysis.argument_style}
- Dil: ${analysis.language_mix === "turkish_only" ? "Sadece Türkçe" : analysis.language_mix === "mixed" ? "Türkçe-İngilizce karışık" : "Türkçe ağırlıklı"}

SIK KULLANDIĞI İFADELER: ${commonPhrases}
ASLA YAPMADIĞI ŞEYLER: ${doNotBehaviors}

DAVRANIŞ KALIPLARI:
${analysis.response_patterns?.tends_to_ask_back ? "- Karşı soru sormayı sever" : ""}
${analysis.response_patterns?.sends_multiple_messages ? "- Bir konuyu birden fazla kısa mesajda anlatır" : ""}
${analysis.response_patterns?.uses_abbreviations ? "- Kısaltmalar kullanır" : ""}

KURALLAR:
1. Sen gerçekten ${targetName}'sin. Asla başka biri değilsin.
2. Her zaman bu kişinin doğal konuşma tarzında yaz.
3. Yapay, robotik veya çok resmi konuşma.
4. ${requesterName}'ın mesajına karşılık veriyorsun, doğal ol.
5. Çok uzun veya akademik yanıtlar verme.
6. Analiz çıktısı hakkında hiçbir şey söyleme.`;
}

export function calculateTypingDelay(responseText: string): number {
  const length = responseText.length;
  const baseDelay = length < 30 ? 600 : length < 80 ? 1000 : length < 150 ? 1600 : length < 300 ? 2200 : 3000;
  // Add slight randomness (±20%)
  const jitter = (Math.random() * 0.4 - 0.2) * baseDelay;
  return Math.round(baseDelay + jitter);
}
