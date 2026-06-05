import { ILLMAdapter } from "@/adapters/llm/interface"
import { runAgent } from "@/lib/agent-runner"
import { TraderInput, TraderOutput, traderInputSchema, traderOutputSchema } from "./schema"
import { TRADER_PROMPT } from "./prompt"
import { AgentRunResult } from "@/types"

export async function runTrader(
  llm: ILLMAdapter, input: TraderInput
): Promise<AgentRunResult<TraderOutput>> {
  return runAgent<TraderOutput>(llm, {
    systemPrompt: TRADER_PROMPT, inputSchema: traderInputSchema,
    outputSchema: traderOutputSchema, input, agentName: "Trader", temperature: 0.3,
  })
}
