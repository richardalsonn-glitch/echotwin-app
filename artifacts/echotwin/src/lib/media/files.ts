export type MediaKind = "image" | "audio" | "video" | "document" | "unknown";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "wav", "ogg", "opus", "aac", "webm"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "avi", "webm"]);

export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function getMediaKindFromFileName(fileName: string): MediaKind {
  const extension = getFileExtension(fileName);
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (extension) return "document";
  return "unknown";
}

export function getContentTypeForFileName(fileName: string): string {
  const extension = getFileExtension(fileName);

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "ogg":
    case "opus":
      return "audio/ogg";
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

export function getBaseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

export function normalizeMediaFileName(fileName: string): string {
  return getBaseName(fileName).trim().toLowerCase();
}

export function createSafeStorageName(fileName: string): string {
  const baseName = getBaseName(fileName);
  const extension = getFileExtension(baseName);
  const stem = baseName.replace(/\.[^.]+$/, "") || "media";
  const safeStem = stem
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return `${safeStem || "media"}${extension ? `.${extension}` : ""}`;
}
