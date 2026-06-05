import { z } from "zod"
import { positionSchema, newsArticleSchema, thesisSchema } from "@/schemas"

export const newsAgentInputSchema = z.object({
  ticker: z.string().min(1).max(10),
  thesis: thesisSchema,
  news: z.array(newsArticleSchema),
  opponentArguments: z.string().optional(),
  round: z.number().int().min(1).max(3),
})

export const newsAgentOutputSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  position: positionSchema,
  arguments: z.array(z.string()).min(1).max(5),
  evidence: z.array(z.string()).min(1).max(5),
  confidence: z.number().min(0).max(1),
  sentimentSummary: z.string(),
})

export type NewsAgentInput = z.infer<typeof newsAgentInputSchema>
export type NewsAgentOutput = z.infer<typeof newsAgentOutputSchema>
