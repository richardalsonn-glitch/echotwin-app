import type { ParsedChat, ParsedMediaItem } from "@/lib/parser";
import { normalizeMediaFileName, type MediaKind } from "./files";

export type MediaMemoryItem = {
  id: string;
  sender: string;
  timestamp: string;
  file_name: string | null;
  normalized_name: string | null;
  media_type: MediaKind;
  content: string;
  storage_url: string | null;
  context_before: string[];
  context_after: string[];
};

export function buildMediaMemoryItems(
  parsed: ParsedChat,
  uploadedUrlsByName: Map<string, string>
): MediaMemoryItem[] {
  return parsed.media_items.map((item) => {
    const normalizedName = item.file_name ? normalizeMediaFileName(item.file_name) : null;

    return {
      id: item.id,
      sender: item.sender,
      timestamp: item.timestamp.toISOString(),
      file_name: item.file_name,
      normalized_name: normalizedName,
      media_type: item.media_type,
      content: item.content,
      storage_url: normalizedName ? uploadedUrlsByName.get(normalizedName) ?? null : null,
      context_before: item.context_before,
      context_after: item.context_after,
    };
  });
}

export function getMediaMemoryItems(value: unknown): MediaMemoryItem[] {
  const root = getObjectValue(value);
  const direct = root.media_memory;
  if (!Array.isArray(direct)) return [];

  return direct.map(toMediaMemoryItem).filter((item): item is MediaMemoryItem => item !== null);
}

export function buildMediaMemorySummary(items: MediaMemoryItem[], maxItems = 8): string {
  const images = items
    .filter((item) => item.media_type === "image")
    .slice(-maxItems);

  if (images.length === 0) {
    return "Gecmis sohbet yuklemesinde fotograf hafizasi bulunmuyor.";
  }

  return images
    .map((item, index) => {
      const before = item.context_before.slice(-1).join(" | ");
      const after = item.context_after.slice(0, 1).join(" | ");
      const context = [before, after].filter(Boolean).join(" / ");
      return `${index + 1}. ${item.sender}, ${item.file_name ?? "isimsiz fotograf"}, ${item.timestamp}${
        context ? `, baglam: ${context}` : ""
      }`;
    })
    .join("\n");
}

export function getComparableImageMemories(items: MediaMemoryItem[], maxItems = 3): MediaMemoryItem[] {
  return items
    .filter((item) => item.media_type === "image" && Boolean(item.storage_url))
    .slice(-maxItems);
}

function toMediaMemoryItem(value: unknown): MediaMemoryItem | null {
  const item = getObjectValue(value);
  const mediaType = toMediaKind(item.media_type);
  if (!mediaType) return null;

  return {
    id: getString(item.id) ?? crypto.randomUUID(),
    sender: getString(item.sender) ?? "",
    timestamp: getString(item.timestamp) ?? new Date().toISOString(),
    file_name: getString(item.file_name),
    normalized_name: getString(item.normalized_name),
    media_type: mediaType,
    content: getString(item.content) ?? "",
    storage_url: getString(item.storage_url),
    context_before: getStringArray(item.context_before),
    context_after: getStringArray(item.context_after),
  };
}

function getObjectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function toMediaKind(value: unknown): MediaKind | null {
  return value === "image" ||
    value === "audio" ||
    value === "video" ||
    value === "document" ||
    value === "unknown"
    ? value
    : null;
}
