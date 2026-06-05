import { z } from "zod"
import { positionSchema, priceBarSchema, thesisSchema } from "@/schemas"

export const technicalAgentInputSchema = z.object({
  ticker: z.string().min(1).max(10),
  thesis: thesisSchema,
  priceBars: z.array(priceBarSchema),
  opponentArguments: z.string().optional(),
  round: z.number().int().min(1).max(3),
})

export const technicalAgentOutputSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  position: positionSchema,
  arguments: z.array(z.string()).min(1).max(5),
  evidence: z.array(z.string()).min(1).max(5),
  confidence: z.number().min(0).max(1),
  trend: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
  setupQuality: z.number().min(0).max(100),
  entryZone: z.object({
    lower: z.number().positive(),
    upper: z.number().positive(),
  }).optional(),
  stopLogic: z.string().optional(),
  invalidations: z.array(z.string()).max(5),
  technicalSummary: z.string(),
})

export type TechnicalAgentInput = z.infer<typeof technicalAgentInputSchema>
export type TechnicalAgentOutput = z.infer<typeof technicalAgentOutputSchema>
