import { ILLMAdapter } from "@/adapters/llm/interface"
import { runAgent } from "@/lib/agent-runner"
import {
  MainThesisInput,
  MainThesisOutput,
  MainJudgmentInput,
  MainJudgmentOutput,
  mainThesisInputSchema,
  mainThesisOutputSchema,
  mainJudgmentInputSchema,
  mainJudgmentOutputSchema,
} from "./schema"
import { MAIN_THESIS_PROMPT, MAIN_JUDGMENT_PROMPT } from "./prompt"
import { AgentRunResult } from "@/types"

export async function runMainThesis(
  llm: ILLMAdapter,
  input: MainThesisInput
): Promise<AgentRunResult<MainThesisOutput>> {
  return runAgent<MainThesisOutput>(llm, {
    systemPrompt: MAIN_THESIS_PROMPT,
    inputSchema: mainThesisInputSchema,
    outputSchema: mainThesisOutputSchema,
    input,
    agentName: "Main-Thesis",
    temperature: 0.4,
  })
}

export async function runMainJudgment(
  llm: ILLMAdapter,
  input: MainJudgmentInput
): Promise<AgentRunResult<MainJudgmentOutput>> {
  return runAgent<MainJudgmentOutput>(llm, {
    systemPrompt: MAIN_JUDGMENT_PROMPT,
    inputSchema: mainJudgmentInputSchema,
    outputSchema: mainJudgmentOutputSchema,
    input,
    agentName: "Main-Judgment",
    temperature: 0.3,
  })
}
