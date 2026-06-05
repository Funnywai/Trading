import { z } from "zod"
import { positionSchema, thesisSchema } from "@/schemas"

export const bearResearcherInputSchema = z.object({
  ticker: z.string().min(1).max(10),
  thesis: thesisSchema,
  analystReports: z.array(z.object({
    agentId: z.string(), agentName: z.string(),
    position: positionSchema, arguments: z.array(z.string()),
    evidence: z.array(z.string()), confidence: z.number(),
  })),
  opponentArguments: z.string().optional(),
  round: z.number().int().min(1).max(3),
})

export const bearResearcherOutputSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  position: positionSchema,
  arguments: z.array(z.string()).min(1).max(5),
  evidence: z.array(z.string()).min(1).max(5),
  confidence: z.number().min(0).max(1),
  keyBearThemes: z.array(z.string()).max(3),
  bearishScore: z.number().min(0).max(100),
  summary: z.string(),
})

export type BearResearcherInput = z.infer<typeof bearResearcherInputSchema>
export type BearResearcherOutput = z.infer<typeof bearResearcherOutputSchema>
