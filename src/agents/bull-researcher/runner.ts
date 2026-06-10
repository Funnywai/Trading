import { ILLMAdapter } from "@/adapters/llm/interface"
import { runAgent } from "@/lib/agent-runner"
import { BullResearcherInput, BullResearcherOutput, bullResearcherInputSchema, bullResearcherOutputSchema } from "./schema"
import { BULL_RESEARCHER_PROMPT } from "./prompt"
import { AgentRunResult } from "@/types"
import { DEEPSEEK_V4_PRO_MODEL } from "@/lib/constants"

export async function runBullResearcher(
  llm: ILLMAdapter, input: BullResearcherInput
): Promise<AgentRunResult<BullResearcherOutput>> {
  return runAgent<BullResearcherOutput>(llm, {
    systemPrompt: BULL_RESEARCHER_PROMPT, inputSchema: bullResearcherInputSchema,
    outputSchema: bullResearcherOutputSchema, input, agentName: "Bull-Researcher", temperature: 0.4,
    model: DEEPSEEK_V4_PRO_MODEL,
  })
}
