import { ILLMAdapter } from "@/adapters/llm/interface"
import { runAgent } from "@/lib/agent-runner"
import { AnalystPassInput, AnalystPassOutput, analystPassInputSchema, analystPassOutputSchema } from "./schema"
import { ANALYST_PASS_PROMPT } from "./prompt"
import { AgentRunResult } from "@/types"

export async function runAnalystPass(
  llm: ILLMAdapter,
  input: AnalystPassInput
): Promise<AgentRunResult<AnalystPassOutput>> {
  return runAgent<AnalystPassOutput>(llm, {
    systemPrompt: ANALYST_PASS_PROMPT,
    inputSchema: analystPassInputSchema,
    outputSchema: analystPassOutputSchema,
    input,
    agentName: "Analyst-Pass",
    temperature: 0.4,
  })
}
