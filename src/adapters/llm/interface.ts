export interface ILLMAdapter {
  chat(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: {
      temperature?: number
      maxTokens?: number
      responseSchema?: object
      model?: string
    }
  ): Promise<{
    content: string
    tokensUsed: number
  }>
}
