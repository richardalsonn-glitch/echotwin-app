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
  const textEntry = findChatTextEntry(entries);

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
    warnings: mediaFiles.length === 0 ? ["Zip icinde medya dosyasi bulunamadi"] : [],
  };
}

function findChatTextEntry(entries: JSZipObject[]): JSZipObject | null {
  const textEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith(".txt"));
  if (textEntries.length === 0) return null;

  return (
    textEntries.find((entry) => {
      const baseName = getBaseName(entry.name).toLowerCase();
      return baseName.includes("chat") || baseName.includes("sohbet");
    }) ?? textEntries[0]
  );
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
