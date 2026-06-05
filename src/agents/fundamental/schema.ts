import { z } from "zod"
import { positionSchema, fundamentalDataSchema, thesisSchema } from "@/schemas"

export const fundamentalAgentInputSchema = z.object({
  ticker: z.string().min(1).max(10),
  thesis: thesisSchema,
  fundamentals: fundamentalDataSchema,
  opponentArguments: z.string().optional(),
  round: z.number().int().min(1).max(3),
})

export const fundamentalAgentOutputSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  position: positionSchema,
  arguments: z.array(z.string()).min(1).max(5),
  evidence: z.array(z.string()).min(1).max(5),
  confidence: z.number().min(0).max(1),
  businessQuality: z.string(),
  financialTrend: z.string(),
  valuationSanityCheck: z.string(),
  valuationSummary: z.string(),
})

export type FundamentalAgentInput = z.infer<typeof fundamentalAgentInputSchema>
export type FundamentalAgentOutput = z.infer<typeof fundamentalAgentOutputSchema>
