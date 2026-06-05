import { z } from "zod"
import { positionSchema, thesisSchema, newsArticleSchema } from "@/schemas"

export const sentimentInputSchema = z.object({
  ticker: z.string().min(1).max(10),
  thesis: thesisSchema,
  news: z.array(newsArticleSchema),
  round: z.number().int().min(1).max(3),
})

export const sentimentOutputSchema = z.object({
  agentId: z.string(), agentName: z.string(), position: positionSchema,
  arguments: z.array(z.string()).min(1).max(5),
  evidence: z.array(z.string()).min(1).max(5),
  confidence: z.number().min(0).max(1),
  sentimentScore: z.number().min(-100).max(100),
  sentimentSummary: z.string(),
})

export type SentimentInput = z.infer<typeof sentimentInputSchema>
export type SentimentOutput = z.infer<typeof sentimentOutputSchema>
