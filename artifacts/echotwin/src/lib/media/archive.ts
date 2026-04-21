import JSZip, { type JSZipObject } from "jszip";
import {
  getBaseName,
  getContentTypeForFileName,
  getMediaKindFromFileName,
  normalizeMediaFileName,
  type MediaKind,
} from "./files";

export type ChatUploadSourceType = "txt" | "zip";

export type ZipMediaFile = {
  path: string;
  fileName: string;
  normalizedName: string;
  mediaType: MediaKind;
  contentType: string;
  readBytes(): Promise<Uint8Array>;
};

export type ChatUploadExtraction = {
  sourceType: ChatUploadSourceType;
  chatFileName: string;
  rawText: string;
  mediaFiles: ZipMediaFile[];
  warnings: string[];
};

export async function extractChatUpload(file: File): Promise<ChatUploadExtraction> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".txt")) {
    return {
      sourceType: "txt",
      chatFileName: file.name,
      rawText: await file.text(),
      mediaFiles: [],
      warnings: [],
    };
  }

  if (!lowerName.endsWith(".zip")) {
    throw new Error("Yalnizca .txt veya .zip dosyasi kabul edilir");
  }

  return extractZipChatUpload(file);
}

async function extractZipChatUpload(file: File): Promise<ChatUploadExtraction> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const textEntry = await findChatTextEntry(entries);

  if (!textEntry) {
    throw new Error("Zip icinde sohbet .txt dosyasi bulunamadi");
  }

  const mediaFiles: ZipMediaFile[] = entries
    .filter((entry) => entry.name !== textEntry.name)
    .map((entry) => toZipMediaFile(entry))
    .filter((entry): entry is ZipMediaFile => entry !== null);

  return {
    sourceType: "zip",
    chatFileName: getBaseName(textEntry.name),
    rawText: await textEntry.async("string"),
    mediaFiles,
    warnings: [],
  };
}

async function findChatTextEntry(entries: JSZipObject[]): Promise<JSZipObject | null> {
  const visibleEntries = entries.filter((entry) => !isSystemZipEntry(entry));
  const textEntries = visibleEntries.filter(isTextFileEntry);
  if (textEntries.length > 0) {
    const sortedTextEntries = [...textEntries].sort(
      (left, right) => getChatTextEntryPriority(left) - getChatTextEntryPriority(right)
    );
    return sortedTextEntries[0] ?? null;
  }

  for (const entry of visibleEntries.filter(isPlainTextFallbackCandidate)) {
    if (await looksLikeWhatsAppChatText(entry)) {
      return entry;
    }
  }

  return null;
}

function isTextFileEntry(entry: JSZipObject): boolean {
  const lowerName = entry.name.trim().toLowerCase();
  return lowerName.endsWith(".txt") || lowerName.endsWith(".text");
}

function isSystemZipEntry(entry: JSZipObject): boolean {
  const segments = entry.name
    .split(/[\\/]+/)
    .map((segment) => segment.trim().toLowerCase());

  return segments.some((segment) => segment === "__macosx" || segment.startsWith("._"));
}

function getChatTextEntryPriority(entry: JSZipObject): number {
  const baseName = getBaseName(entry.name).trim().toLowerCase();
  const fullName = entry.name.trim().toLowerCase();

  if (baseName === "_chat.txt" || baseName === "chat.txt") return 0;
  if (baseName.includes("whatsapp") && baseName.includes("chat")) return 1;
  if (baseName.includes("sohbet") || baseName.includes("chat")) return 2;
  if (fullName.endsWith(".txt")) return 3;
  return 4;
}

function isPlainTextFallbackCandidate(entry: JSZipObject): boolean {
  const baseName = getBaseName(entry.name).trim();
  if (!baseName || baseName.includes(".")) return false;
  return getMediaKindFromFileName(baseName) === "unknown";
}

async function looksLikeWhatsAppChatText(entry: JSZipObject): Promise<boolean> {
  try {
    const text = await entry.async("string");
    const sample = text.slice(0, 8000);
    const hasDateLine = /(?:^|\r?\n)(?:\[?\d{1,2}[./-]\d{1,2}[./-]\d{2,4}[,\]\s-]+)\d{1,2}:\d{2}/.test(
      sample
    );
    const hasSenderDelimiter = /(?:^|\r?\n).{1,80}:\s+\S/.test(sample);
    return hasDateLine && hasSenderDelimiter;
  } catch {
    return false;
  }
}

function toZipMediaFile(entry: JSZipObject): ZipMediaFile | null {
  const fileName = getBaseName(entry.name);
  const mediaType = getMediaKindFromFileName(fileName);
  if (mediaType === "unknown") return null;

  return {
    path: entry.name,
    fileName,
    normalizedName: normalizeMediaFileName(fileName),
    mediaType,
    contentType: getContentTypeForFileName(fileName),
    readBytes: () => entry.async("uint8array"),
  };
}
