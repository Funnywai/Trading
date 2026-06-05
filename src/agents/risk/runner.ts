import { ILLMAdapter } from "@/adapters/llm/interface"
import { runAgent } from "@/lib/agent-runner"
import { RiskAgentInput, RiskAgentOutput, riskAgentInputSchema, riskAgentOutputSchema } from "./schema"
import { RISK_AGENT_PROMPT } from "./prompt"
import { AgentRunResult } from "@/types"

export async function runRiskAgent(
  llm: ILLMAdapter,
  input: RiskAgentInput
): Promise<AgentRunResult<RiskAgentOutput>> {
  return runAgent<RiskAgentOutput>(llm, {
    systemPrompt: RISK_AGENT_PROMPT,
    inputSchema: riskAgentInputSchema,
    outputSchema: riskAgentOutputSchema,
    input,
    agentName: "Risk-Agent",
    temperature: 0.3,
  })
}
