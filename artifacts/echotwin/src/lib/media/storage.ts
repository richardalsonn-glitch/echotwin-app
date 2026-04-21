import { createSafeStorageName } from "./files";

export const CHAT_MEDIA_BUCKET = "chat-media";

export function createChatMediaStoragePath(params: {
  userId: string;
  scopeId: string;
  fileName: string;
}): string {
  return `${params.userId}/${params.scopeId}/${Date.now()}-${crypto.randomUUID()}-${createSafeStorageName(
    params.fileName
  )}`;
}
