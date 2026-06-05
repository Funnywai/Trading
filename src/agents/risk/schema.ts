import { z } from "zod"
import { thesisSchema, riskMetricsSchema } from "@/schemas"

export const riskAgentInputSchema = z.object({
  ticker: z.string().min(1).max(10),
  thesis: thesisSchema,
  portfolio: z.object({
    totalValue: z.number().nonnegative(),
    holdings: z.array(z.object({
      ticker: z.string(),
      allocation: z.number().min(0).max(1),
    })),
    cashRatio: z.number().min(0).max(1),
  }),
  riskMetrics: riskMetricsSchema.optional(),
})

export const riskAgentOutputSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  maxPositionSize: z.number().nonnegative(),
  suggestedStopLoss: z.number().positive(),
  portfolioImpact: z.string(),
  warnings: z.array(z.string()),
  riskScore: z.number().min(0).max(100),
})

export type RiskAgentInput = z.infer<typeof riskAgentInputSchema>
export type RiskAgentOutput = z.infer<typeof riskAgentOutputSchema>
