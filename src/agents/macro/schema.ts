import { z } from "zod"
import { positionSchema, thesisSchema } from "@/schemas"

export const macroInputSchema = z.object({
  ticker: z.string().min(1).max(10),
  thesis: thesisSchema,
  macroData: z.object({
    spyChange: z.number(),
    qqqChange: z.number(),
    vixLevel: z.number(),
    us10y: z.number(),
    dxy: z.number(),
    oil: z.number(),
    marketRegime: z.enum(["RISK_ON", "RISK_OFF", "NEUTRAL"]),
    sectorRotation: z.string(),
  }),
  round: z.number().int().min(1).max(3),
})

export const macroOutputSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  position: positionSchema,
  arguments: z.array(z.string()).min(1).max(5),
  evidence: z.array(z.string()).min(1).max(5),
  confidence: z.number().min(0).max(1),
  regimeAssessment: z.string(),
  macroSummary: z.string(),
})

export type MacroInput = z.infer<typeof macroInputSchema>
export type MacroOutput = z.infer<typeof macroOutputSchema>
