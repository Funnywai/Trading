import { z } from "zod"
import { thesisSchema, researchMemoSchema } from "@/schemas"

export const researchManagerInputSchema = z.object({
  ticker: z.string().min(1).max(10),
  thesis: thesisSchema,
  bullCase: z.object({
    arguments: z.array(z.string()), evidence: z.array(z.string()),
    keyThemes: z.array(z.string()), score: z.number(), summary: z.string(),
  }),
  bearCase: z.object({
    arguments: z.array(z.string()), evidence: z.array(z.string()),
    keyThemes: z.array(z.string()), score: z.number(), summary: z.string(),
  }),
  verifierReport: z.object({
    evidenceCoverageScore: z.number(), canProceedToFinal: z.boolean(),
    unsupportedClaims: z.array(z.string()),
  }).nullable(),
})

export const researchManagerOutputSchema = researchMemoSchema

export type ResearchManagerInput = z.infer<typeof researchManagerInputSchema>
export type ResearchManagerOutput = z.infer<typeof researchManagerOutputSchema>
