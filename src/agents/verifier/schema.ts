import { z } from "zod"
import { thesisSchema, evidenceGateOutputSchema } from "@/schemas"

export const verifierInputSchema = z.object({
  ticker: z.string().min(1).max(10),
  thesis: thesisSchema,
  rounds: z.array(z.object({
    round: z.number(),
    arguments: z.array(z.object({
      agentId: z.string(), agentName: z.string(),
      position: z.enum(["SUPPORT", "OPPOSE", "NEUTRAL"]),
      arguments: z.array(z.string()), evidence: z.array(z.string()), confidence: z.number(),
    })),
  })),
  dataQuality: z.object({
    newsCount: z.number(), missingFundamentalFields: z.array(z.string()),
    staleFlags: z.array(z.string()), qualityScore: z.number().min(0).max(100),
  }).optional(),
})

export const verifierOutputSchema = evidenceGateOutputSchema

export type VerifierInput = z.infer<typeof verifierInputSchema>
export type VerifierOutput = z.infer<typeof verifierOutputSchema>
