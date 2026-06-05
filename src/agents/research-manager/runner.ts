import { ILLMAdapter } from "@/adapters/llm/interface"
import { runAgent } from "@/lib/agent-runner"
import { ResearchManagerInput, ResearchManagerOutput, researchManagerInputSchema, researchManagerOutputSchema } from "./schema"
import { RESEARCH_MANAGER_PROMPT } from "./prompt"
import { AgentRunResult } from "@/types"

export async function runResearchManager(
  llm: ILLMAdapter, input: ResearchManagerInput
): Promise<AgentRunResult<ResearchManagerOutput>> {
  return runAgent<ResearchManagerOutput>(llm, {
    systemPrompt: RESEARCH_MANAGER_PROMPT, inputSchema: researchManagerInputSchema,
    outputSchema: researchManagerOutputSchema, input, agentName: "Research-Manager", temperature: 0.3,
  })
}
