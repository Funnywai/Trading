import { ILLMAdapter } from "@/adapters/llm/interface"
import { AgentRunResult } from "@/types"
import { sleep } from "@/lib/utils"
import { MAX_RETRIES, RETRY_DELAY_MS } from "@/lib/constants"
import { ZodTypeAny } from "zod"

export async function runAgent<T>(
  llm: ILLMAdapter,
  config: {
    systemPrompt: string
    inputSchema: ZodTypeAny
    outputSchema: ZodTypeAny
    input: unknown
    agentName: string
    temperature?: number
    model?: string
  }
): Promise<AgentRunResult<T>> {
  const startTime = Date.now()

  const parsedInput = config.inputSchema.safeParse(config.input)
  if (!parsedInput.success) {
    return {
      success: false,
      error: `[${config.agentName}] Input validation failed: ${parsedInput.error.message}`,
      tokensUsed: 0,
      durationMs: Date.now() - startTime,
    }
  }

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: config.systemPrompt },
    { role: "user", content: JSON.stringify(parsedInput.data, null, 2) },
  ]

  let totalTokens = 0

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await llm.chat(messages, {
        temperature: config.temperature ?? 0.3,
        responseSchema: config.outputSchema,
        model: config.model,
      })
      totalTokens += response.tokensUsed

      let parsed: unknown
      try {
        parsed = JSON.parse(response.content)
      } catch {
        if (attempt < MAX_RETRIES) {
          messages.push({ role: "assistant", content: response.content })
          messages.push({
            role: "user",
            content: `Output was not valid JSON. Please output ONLY valid JSON matching the required schema.`,
          })
          await sleep(RETRY_DELAY_MS)
          continue
        }
        return {
          success: false,
          error: `[${config.agentName}] Failed to parse LLM output as JSON after ${MAX_RETRIES} retries`,
          tokensUsed: totalTokens,
          durationMs: Date.now() - startTime,
        }
      }

      const validated = config.outputSchema.safeParse(parsed)
      if (!validated.success) {
        if (attempt < MAX_RETRIES) {
          messages.push({ role: "assistant", content: response.content })
          messages.push({
            role: "user",
            content: `Output validation failed: ${validated.error.message}. Fix your output to match the required schema exactly. Output ONLY valid JSON.`,
          })
          await sleep(RETRY_DELAY_MS)
          continue
        }
        return {
          success: false,
          error: `[${config.agentName}] Schema validation failed after retries: ${validated.error.message}`,
          tokensUsed: totalTokens,
          durationMs: Date.now() - startTime,
        }
      }

      return {
        success: true,
        data: validated.data as T,
        tokensUsed: totalTokens,
        durationMs: Date.now() - startTime,
      }
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS)
        continue
      }
      return {
        success: false,
        error: `[${config.agentName}] LLM error: ${err instanceof Error ? err.message : "Unknown"}`,
        tokensUsed: totalTokens,
        durationMs: Date.now() - startTime,
      }
    }
  }

  return {
    success: false,
    error: `[${config.agentName}] Max retries exceeded`,
    tokensUsed: totalTokens,
    durationMs: Date.now() - startTime,
  }
}
