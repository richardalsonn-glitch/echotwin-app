import type { ParsedMessage, ParsedChat } from "./types.js";

/* ─── Date/time patterns covering all major WhatsApp export formats ── */
const PATTERNS = [
  // [DD.MM.YYYY, HH:MM] Name: msg  (iOS square bracket)
  /^\[(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\]\s+(.+?):\s([\s\S]+)$/,
  // DD.MM.YYYY, HH:MM - Name: msg  (Android comma-dash)
  /^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\s+-\s+(.+?):\s([\s\S]+)$/,
  // DD.MM.YYYY HH:MM - Name: msg  (Android no-comma)
  /^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\s+-\s+(.+?):\s([\s\S]+)$/,
  // YYYY-MM-DD HH:MM:SS Name: msg  (ISO variant)
  /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)\s+-\s+(.+?):\s([\s\S]+)$/,
];

const MEDIA_INDICATORS = [
  "<media omitted>", "<medya dahil edilmedi>", "image omitted", "video omitted",
  "audio omitted", "document omitted", "sticker omitted", "gif omitted",
  "fotoğraf dahil edilmedi", "görüntü dahil edilmedi",
  ".jpg", ".png", ".mp4", ".mp3", ".pdf", ".webp", ".opus",
];

/* ─── System message patterns to filter out ── */
const SYSTEM_MESSAGE_PATTERNS = [
  // English
  /^messages and calls are end-to-end encrypted/i,
  /^.+ added .+/i,
  /^.+ removed .+/i,
  /^.+ left$/i,
  /^.+ changed (the|their|this)/i,
  /^.+ changed (the group|their phone number)/i,
  /^.+ was added$/i,
  /^.+ created group/i,
  /^you were added$/i,
  /^this message was deleted/i,
  /^you deleted this message/i,
  /^missed (voice|video) call/i,
  /^.+ joined using this group's invite link/i,
  /^security code changed/i,
  /^\+\d+ is not in your contacts/i,
  // Turkish
  /^mesajlar ve aramalar uçtan uca şifreli/i,
  /^.+ eklendi$/i,
  /^.+ ekledi/i,
  /^.+ çıkardı/i,
  /^.+ gruptan ayrıldı/i,
  /^.+ grup açıklamasını değiştirdi/i,
  /^.+ grup simgesini değiştirdi/i,
  /^.+ grup adını değiştirdi/i,
  /^.+ telefon numarasını değiştirdi/i,
  /^bu mesaj silindi/i,
  /^mesajı sildiniz/i,
  /^kaçırılan sesli arama/i,
  /^kaçırılan görüntülü arama/i,
  /^grup oluşturuldu/i,
  /^.+ bu gruba katıldı/i,
  /^güvenlik kodu değişti/i,
  // Generic
  /^null$/i,
  /^\s*$/,
];

const QUESTION_WORDS_TR = ["mi", "mı", "mu", "mü", "ne", "nasıl", "neden", "niye", "kim", "nerede", "ne zaman", "hangi", "kaç"];
const QUESTION_WORDS_EN = ["what", "how", "why", "who", "where", "when", "which", "could", "would", "should", "can", "will", "do", "does", "did", "is", "are", "was", "were"];

function isMedia(content: string): boolean {
  const lower = content.toLowerCase();
  return MEDIA_INDICATORS.some((i) => lower.includes(i.toLowerCase()));
}

function isSystemMessage(content: string): boolean {
  return SYSTEM_MESSAGE_PATTERNS.some((p) => p.test(content.trim()));
}

function isTooShort(content: string): boolean {
  return content.trim().length < 2;
}

function hasQuestion(content: string): boolean {
  if (content.includes("?")) return true;
  const words = content.toLowerCase().split(/\s+/);
  return words.some((w) => QUESTION_WORDS_TR.includes(w) || QUESTION_WORDS_EN.includes(w));
}

function parseDate(dateStr: string, timeStr: string): Date {
  const d = dateStr.replace(/[.\-]/g, "/");
  const parts = d.split("/").map(Number);
  const cleanTime = timeStr.replace(/\s?[AP]M/i, "");
  const timeParts = cleanTime.split(":").map(Number);
  const isPM = /PM/i.test(timeStr);
  const isAM = /AM/i.test(timeStr);

  let day: number, month: number, year: number;
  // YYYY-MM-DD format (first part > 31 means it's the year)
  if (parts[0] > 31) {
    [year, month, day] = parts;
  } else if (parts[2] > 31) {
    [day, month, year] = parts;
  } else {
    // Ambiguous — assume DD/MM/YY
    [day, month, year] = parts;
  }
  if (year < 100) year += 2000;

  let hours = timeParts[0] ?? 0;
  const minutes = timeParts[1] ?? 0;
  const seconds = timeParts[2] ?? 0;
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  return isNaN(date.getTime()) ? new Date(0) : date;
}

function tryParseMessage(line: string): { timestamp: Date; sender: string; content: string } | null {
  for (const pattern of PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      try {
        const timestamp = parseDate(match[1], match[2]);
        const sender = match[3].trim();
        const content = match[4].trim();
        if (timestamp.getTime() > 0 && sender && content) {
          return { timestamp, sender, content };
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

function isRealParticipant(sender: string, content: string): boolean {
  if (isSystemMessage(content)) return false;
  // Detect system senders (they don't have a colon-separated format)
  if (sender.includes("changed") || sender.includes("added") || sender.includes("Messages")) return false;
  return true;
}

export function parseWhatsAppChat(rawText: string): ParsedChat {
  const lines = rawText.split("\n");
  const rawMessages: { timestamp: Date; sender: string; content: string }[] = [];
  let current: { timestamp: Date; sender: string; content: string } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parsed = tryParseMessage(trimmed);
    if (parsed) {
      if (current) rawMessages.push(current);
      current = parsed;
    } else if (current) {
      // Multi-line message continuation
      current.content += "\n" + trimmed;
    }
  }
  if (current) rawMessages.push(current);

  if (rawMessages.length === 0) {
    throw new Error("Sohbet dosyası parse edilemedi. Geçerli bir WhatsApp dışa aktarma dosyası olduğundan emin ol.");
  }

  /* ─── Build participant set (excluding system senders) ── */
  const participantCounts = new Map<string, number>();
  for (const msg of rawMessages) {
    if (!isRealParticipant(msg.sender, msg.content)) continue;
    if (isMedia(msg.content)) continue;
    if (isTooShort(msg.content)) continue;
    participantCounts.set(msg.sender, (participantCounts.get(msg.sender) ?? 0) + 1);
  }

  // Sort participants by message count (most active first)
  const participants = Array.from(participantCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  if (participants.length === 0) {
    throw new Error("Sohbette geçerli katılımcı bulunamadı.");
  }

  /* ─── Build full message list ── */
  const messages: ParsedMessage[] = [];
  let turnIndex = 0;

  for (let i = 0; i < rawMessages.length; i++) {
    const raw = rawMessages[i];
    if (!participants.includes(raw.sender)) continue;
    if (isSystemMessage(raw.content)) continue;
    if (isMedia(raw.content)) continue;

    const prevSender = i > 0 ? rawMessages[i - 1]?.sender : null;
    const isReply = prevSender !== null && prevSender !== raw.sender;

    messages.push({
      id: crypto.randomUUID(),
      timestamp: raw.timestamp,
      sender: raw.sender,
      content: raw.content,
      is_media: false,
      conversation_turn_index: turnIndex++,
      is_reply: isReply,
      message_length: raw.content.length,
      has_question: hasQuestion(raw.content),
    });
  }

  /* ─── Stats (exclude very short messages from averages) ── */
  const stats: ParsedChat["stats"] = {};
  for (const participant of participants) {
    const senderMsgs = messages.filter(
      (m) => m.sender === participant && m.message_length >= 2
    );
    if (senderMsgs.length === 0) continue;

    const avgLen = senderMsgs.reduce((sum, m) => sum + m.message_length, 0) / senderMsgs.length;
    const questionCount = senderMsgs.filter((m) => m.has_question).length;
    const replyCount = senderMsgs.filter((m) => m.is_reply).length;
    const shortCount = senderMsgs.filter((m) => m.message_length < 30).length;

    stats[participant] = {
      message_count: senderMsgs.length,
      avg_message_length: Math.round(avgLen),
      question_ratio: Math.round((questionCount / senderMsgs.length) * 100) / 100,
      reply_ratio: Math.round((replyCount / senderMsgs.length) * 100) / 100,
      short_message_ratio: Math.round((shortCount / senderMsgs.length) * 100) / 100,
    };
  }

  const timestamps = messages.map((m) => m.timestamp.getTime()).filter((t) => t > 0);
  return {
    participants,
    messages,
    total_messages: messages.length,
    date_range: {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps)),
    },
    stats,
  };
}
