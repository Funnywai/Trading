import { ILLMAdapter } from "@/adapters/llm/interface"
import { runAgent } from "@/lib/agent-runner"
import { BearResearcherInput, BearResearcherOutput, bearResearcherInputSchema, bearResearcherOutputSchema } from "./schema"
import { BEAR_RESEARCHER_PROMPT } from "./prompt"
import { AgentRunResult } from "@/types"
import { DEEPSEEK_V4_PRO_MODEL } from "@/lib/constants"

export async function runBearResearcher(
  llm: ILLMAdapter, input: BearResearcherInput
): Promise<AgentRunResult<BearResearcherOutput>> {
  return runAgent<BearResearcherOutput>(llm, {
    systemPrompt: BEAR_RESEARCHER_PROMPT, inputSchema: bearResearcherInputSchema,
    outputSchema: bearResearcherOutputSchema, input, agentName: "Bear-Researcher", temperature: 0.4,
    model: DEEPSEEK_V4_PRO_MODEL,
  })
}
