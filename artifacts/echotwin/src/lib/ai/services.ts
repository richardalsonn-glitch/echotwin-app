import type { PersonaAnalysis } from "@/types/persona";
import { runResilientPersonaAnalysis, type CachedChatMessage } from "@/lib/ai/analysis-pipeline";
import { analyzeChatImage, type ChatImageAnalysisInput } from "@/lib/ai/image";

export async function analyzeChat(params: {
  messages: CachedChatMessage[];
  targetName: string;
  requesterName: string;
}): Promise<PersonaAnalysis> {
  const result = await runResilientPersonaAnalysis(params);
  return result.analysis;
}

export async function analyzeImage(input: ChatImageAnalysisInput) {
  return analyzeChatImage(input);
}
