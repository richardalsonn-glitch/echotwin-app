import { getMediaKindFromFileName, type MediaKind } from "@/lib/media/files";
import { ParsedMessage, ParsedChat, ParsedMediaItem } from "./types";

// Supported WhatsApp export formats:
// [DD/MM/YYYY, HH:MM:SS] Name: Message
// DD/MM/YYYY, HH:MM - Name: Message
// MM/DD/YY, HH:MM AM/PM - Name: Message
// [DD.MM.YYYY HH:MM:SS] Name: Message

const PATTERNS = [
  // [DD/MM/YYYY, HH:MM:SS] Name: Message
  /^\[(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\]\s+(.+?):\s([\s\S]+)$/,
  // DD/MM/YYYY, HH:MM - Name: Message
  /^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\s+-\s+(.+?):\s([\s\S]+)$/,
  // MM/DD/YY, HH:MM AM/PM - Name: Message
  /^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\s+-\s+(.+?):\s([\s\S]+)$/,
];

const MEDIA_INDICATORS = [
  "<Media omitted>",
  "<Medya dahil edilmedi>",
  "image omitted",
  "video omitted",
  "audio omitted",
  "document omitted",
  "sticker omitted",
  "GIF omitted",
  ".jpg",
  ".png",
  ".mp4",
  ".mp3",
  ".pdf",
  ".webp",
  ".jpeg",
  ".gif",
  ".heic",
  ".m4a",
  ".opus",
];

const QUESTION_WORDS_TR = ["mi", "mı", "mu", "mü", "ne", "nasıl", "neden", "niye", "kim", "nerede", "ne zaman", "hangi", "kaç"];
const QUESTION_WORDS_EN = ["what", "how", "why", "who", "where", "when", "which", "whose", "whom", "could", "would", "should", "can", "will", "do", "does", "did", "is", "are", "was", "were"];

const MEDIA_FILE_PATTERN =
  /([\p{L}\p{N}_ .()@+\-'[\]]+\.(?:jpe?g|png|webp|gif|heic|heif|mp4|mov|m4v|mp3|m4a|wav|ogg|opus|aac|pdf|webm))/iu;

function extractMediaFileName(content: string): string | null {
  const match = content.match(MEDIA_FILE_PATTERN);
  return match?.[1]?.trim() ?? null;
}

function isMedia(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    MEDIA_INDICATORS.some((indicator) => lower.includes(indicator.toLowerCase())) ||
    extractMediaFileName(content) !== null
  );
}

function getMediaType(content: string, fileName: string | null): MediaKind | null {
  if (fileName) return getMediaKindFromFileName(fileName);
  const lower = content.toLowerCase();
  if (lower.includes("image") || lower.includes("foto") || lower.includes("medya")) return "image";
  if (lower.includes("audio") || lower.includes("ses")) return "audio";
  if (lower.includes("video")) return "video";
  if (lower.includes("document") || lower.includes("pdf")) return "document";
  return isMedia(content) ? "unknown" : null;
}

function hasQuestion(content: string): boolean {
  if (content.includes("?")) return true;
  const words = content.toLowerCase().split(/\s+/);
  return words.some(
    (w) => QUESTION_WORDS_TR.includes(w) || QUESTION_WORDS_EN.includes(w)
  );
}

function parseDate(dateStr: string, timeStr: string): Date {
  // Normalize separators
  const d = dateStr.replace(/[.\-]/g, "/");
  const parts = d.split("/").map(Number);
  const timeParts = timeStr.replace(/\s?[AP]M/i, "").split(":").map(Number);
  const isPM = /PM/i.test(timeStr);
  const isAM = /AM/i.test(timeStr);

  let day: number, month: number, year: number;

  if (parts[2] > 31) {
    // YYYY/MM/DD
    [year, month, day] = parts;
  } else if (parts[0] > 12) {
    // DD/MM/YYYY
    [day, month, year] = parts;
  } else {
    // Ambiguous — try DD/MM/YYYY
    [day, month, year] = parts;
  }

  if (year < 100) year += 2000;

  let hours = timeParts[0];
  const minutes = timeParts[1] || 0;
  const seconds = timeParts[2] || 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

function tryParseMessage(
  line: string
): { timestamp: Date; sender: string; content: string } | null {
  for (const pattern of PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      try {
        const timestamp = parseDate(match[1], match[2]);
        const sender = match[3].trim();
        const content = match[4].trim();
        if (!isNaN(timestamp.getTime()) && sender && content) {
          return { timestamp, sender, content };
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function parseWhatsAppChat(rawText: string): ParsedChat {
  const lines = rawText.split("\n");
  const rawMessages: { timestamp: Date; sender: string; content: string }[] = [];

  let currentMessage: { timestamp: Date; sender: string; content: string } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parsed = tryParseMessage(trimmed);
    if (parsed) {
      if (currentMessage) rawMessages.push(currentMessage);
      currentMessage = parsed;
    } else if (currentMessage) {
      // Continuation of previous message
      currentMessage.content += "\n" + trimmed;
    }
  }
  if (currentMessage) rawMessages.push(currentMessage);

  if (rawMessages.length === 0) {
    throw new Error("Sohbet dosyası parse edilemedi. Geçerli bir WhatsApp dışa aktarma dosyası olduğundan emin ol.");
  }

  // Extract unique participants (exclude system messages)
  const participantSet = new Set<string>();
  for (const msg of rawMessages) {
    // Filter out WhatsApp system messages
    if (!msg.sender.includes("changed") && !msg.sender.includes("added") && !msg.sender.includes("Messages and calls")) {
      participantSet.add(msg.sender);
    }
  }
  const participants = Array.from(participantSet);

  // Build enhanced messages
  const messages: ParsedMessage[] = [];
  let turnIndex = 0;

  for (let i = 0; i < rawMessages.length; i++) {
    const raw = rawMessages[i];
    if (!participants.includes(raw.sender)) continue;

    const prevSender = i > 0 ? rawMessages[i - 1].sender : null;
    const isReply = prevSender !== null && prevSender !== raw.sender;

    const mediaFileName = isMedia(raw.content) ? extractMediaFileName(raw.content) : null;
    const mediaType = getMediaType(raw.content, mediaFileName);

    messages.push({
      id: crypto.randomUUID(),
      timestamp: raw.timestamp,
      sender: raw.sender,
      content: raw.content,
      is_media: mediaType !== null,
      media_file_name: mediaFileName,
      media_type: mediaType,
      conversation_turn_index: turnIndex++,
      is_reply: isReply,
      message_length: raw.content.length,
      has_question: hasQuestion(raw.content),
    });
  }

  const mediaItems = buildMediaItems(messages);

  // Build stats per sender
  const stats: ParsedChat["stats"] = {};
  for (const participant of participants) {
    const senderMsgs = messages.filter((m) => m.sender === participant && !m.is_media);
    if (senderMsgs.length === 0) continue;

    const avgLen = senderMsgs.reduce((sum, m) => sum + m.message_length, 0) / senderMsgs.length;
    const questionCount = senderMsgs.filter((m) => m.has_question).length;
    const replyCount = senderMsgs.filter((m) => m.is_reply).length;

    stats[participant] = {
      message_count: senderMsgs.length,
      avg_message_length: Math.round(avgLen),
      question_ratio: Math.round((questionCount / senderMsgs.length) * 100) / 100,
      reply_ratio: Math.round((replyCount / senderMsgs.length) * 100) / 100,
    };
  }

  const timestamps = messages.map((m) => m.timestamp);

  return {
    participants,
    messages,
    media_items: mediaItems,
    media_count: mediaItems.length,
    total_messages: messages.length,
    date_range: {
      start: new Date(Math.min(...timestamps.map((t) => t.getTime()))),
      end: new Date(Math.max(...timestamps.map((t) => t.getTime()))),
    },
    stats,
  };
}

function buildMediaItems(messages: ParsedMessage[]): ParsedMediaItem[] {
  return messages
    .filter((message) => message.is_media)
    .map((message) => {
      const index = messages.findIndex((candidate) => candidate.id === message.id);
      const before = messages
        .slice(Math.max(0, index - 3), index)
        .filter((candidate) => !candidate.is_media)
        .map((candidate) => `${candidate.sender}: ${candidate.content}`)
        .slice(-2);
      const after = messages
        .slice(index + 1, index + 4)
        .filter((candidate) => !candidate.is_media)
        .map((candidate) => `${candidate.sender}: ${candidate.content}`)
        .slice(0, 2);

      return {
        id: crypto.randomUUID(),
        message_id: message.id,
        sender: message.sender,
        timestamp: message.timestamp,
        file_name: message.media_file_name,
        media_type: message.media_type ?? "unknown",
        content: message.content,
        context_before: before,
        context_after: after,
      };
    });
}
