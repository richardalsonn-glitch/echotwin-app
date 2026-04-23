import { generateGeminiText } from "@/lib/ai/gemini";
import type { AiProvider, AiProviderStreamRequest, AiProviderTextRequest } from "@/lib/ai/types";

function toPrompt(messages: AiProviderTextRequest["messages"]): {
  systemInstruction?: string;
  prompt: string;
} {
  const systemInstruction = messages
    .filter((message) => message.role === "system")
    .map((message) => String(message.content))
    .join("\n\n");
  const prompt = messages
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role.toUpperCase()}: ${String(message.content)}`)
    .join("\n\n");

  return {
    systemInstruction: systemInstruction || undefined,
    prompt,
  };
}

export function createGeminiProvider(): AiProvider {
  return {
    name: "gemini",
    async createText(request: AiProviderTextRequest) {
      const prompt = toPrompt(request.messages);
      return generateGeminiText({
        ...prompt,
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
        json: request.responseFormat === "json_object",
      });
    },
    async createStream(request: AiProviderStreamRequest) {
      const prompt = toPrompt(request.messages);
      const content = await generateGeminiText({
        ...prompt,
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      });

      return (async function* streamOnce() {
        yield content;
      })();
    },
  };
}
