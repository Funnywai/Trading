import { ILLMAdapter } from "@/adapters/llm/interface"
import { runAgent } from "@/lib/agent-runner"
import { VerifierInput, VerifierOutput, verifierInputSchema, verifierOutputSchema } from "./schema"
import { VERIFIER_PROMPT } from "./prompt"
import { AgentRunResult } from "@/types"

export async function runVerifierAgent(
  llm: ILLMAdapter,
  input: VerifierInput
): Promise<AgentRunResult<VerifierOutput>> {
  return runAgent<VerifierOutput>(llm, {
    systemPrompt: VERIFIER_PROMPT,
    inputSchema: verifierInputSchema,
    outputSchema: verifierOutputSchema,
    input,
    agentName: "Verifier",
    temperature: 0.2,
  })
}
