import { z } from "zod"
import { thesisSchema, researchMemoSchema, tradeProposalSchema } from "@/schemas"

export const traderInputSchema = z.object({
  ticker: z.string().min(1).max(10),
  thesis: thesisSchema,
  researchMemo: researchMemoSchema,
  riskAssessment: z.object({
    maxPositionSize: z.number(), riskScore: z.number(),
    warnings: z.array(z.string()),
  }).nullable(),
  holdsThisTicker: z.boolean(),
})

export const traderOutputSchema = tradeProposalSchema

export type TraderInput = z.infer<typeof traderInputSchema>
export type TraderOutput = z.infer<typeof traderOutputSchema>
