import { ILLMAdapter } from "./interface"
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, DEEPSEEK_V4_PRO_MODEL, REASONING_EFFORT } from "@/lib/constants"

export class DeepseekAdapter implements ILLMAdapter {
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DEEPSEEK_API_KEY || ""
    if (!this.apiKey) throw new Error("DEEPSEEK_API_KEY is required")
  }

  async chat(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: {
      temperature?: number
      maxTokens?: number
      responseSchema?: object
      model?: string
    }
  ) {
    const model = options?.model ?? DEEPSEEK_MODEL
    const isPro = model === DEEPSEEK_V4_PRO_MODEL

    const body: Record<string, unknown> = {
      model,
      messages,
    }

    if (isPro) {
      body.thinking = { type: "enabled" }
      body.reasoning_effort = REASONING_EFFORT
    }

    if (options?.maxTokens) {
      body.max_tokens = options.maxTokens
    }

    if (options?.responseSchema) {
      body.response_format = { type: "json_object" }
    }

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      let errorMessage = `Deepseek API returned status ${response.status}`
      try {
        const errorBody = await response.json() as any
        if (errorBody.error?.message) {
          errorMessage = errorBody.error.message as string
        }
      } catch {
        errorMessage = response.statusText || errorMessage
      }
      throw new Error(`Deepseek API error: ${errorMessage}`)
    }

    const data = await response.json() as any
    const content = data.choices?.[0]?.message?.content ?? ""
    const tokensUsed = data.usage?.total_tokens ?? 0

    return { content, tokensUsed }
  }
}
