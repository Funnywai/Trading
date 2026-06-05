import { z } from "zod"
import { thesisSchema, finalJudgmentSchema } from "@/schemas"

export const mainThesisInputSchema = z.object({
  ticker: z.string().min(1).max(10),
  currentPrice: z.number().positive(),
  fundamentalsSummary: z.string().optional(),
})

export const mainThesisOutputSchema = thesisSchema

export const mainJudgmentInputSchema = z.object({
  ticker: z.string(),
  currentPrice: z.number().positive(),
  thesis: thesisSchema,
  rounds: z.array(z.object({
    round: z.number(),
    arguments: z.array(z.object({
      agentId: z.string(), agentName: z.string(),
      position: z.enum(["SUPPORT", "OPPOSE", "NEUTRAL"]),
      arguments: z.array(z.string()), evidence: z.array(z.string()), confidence: z.number(),
    })),
  })),
  riskAssessment: z.object({
    maxPositionSize: z.number(), suggestedStopLoss: z.number(),
    portfolioImpact: z.string(), warnings: z.array(z.string()), riskScore: z.number(),
  }).nullable(),
  verifierReport: z.object({
    unsupportedClaims: z.array(z.string()), duplicatedEvidenceIds: z.array(z.string()),
    evidenceCoverageScore: z.number(), canProceedToFinal: z.boolean(), summary: z.string(),
  }).nullable(),
  holdsThisTicker: z.boolean(),
})

export const mainJudgmentOutputSchema = finalJudgmentSchema

export type MainThesisInput = z.infer<typeof mainThesisInputSchema>
export type MainThesisOutput = z.infer<typeof mainThesisOutputSchema>
export type MainJudgmentInput = z.infer<typeof mainJudgmentInputSchema>
export type MainJudgmentOutput = z.infer<typeof mainJudgmentOutputSchema>
