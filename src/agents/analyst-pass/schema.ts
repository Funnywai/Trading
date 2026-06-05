import { z } from "zod"
import { positionSchema, newsArticleSchema, fundamentalDataSchema, thesisSchema, priceBarSchema } from "@/schemas"

export const analystPassInputSchema = z.object({
  ticker: z.string().min(1).max(10),
  thesis: thesisSchema,
  news: z.array(newsArticleSchema),
  fundamentals: fundamentalDataSchema,
  priceBars: z.array(priceBarSchema),
  macroData: z.object({
    spyChange: z.number(),
    qqqChange: z.number(),
    vixLevel: z.number(),
    us10y: z.number(),
    dxy: z.number(),
    oil: z.number(),
    marketRegime: z.enum(["RISK_ON", "RISK_OFF", "NEUTRAL"]),
    sectorRotation: z.string(),
  }).nullable(),
})

const commonAnalystFields = {
  position: positionSchema,
  arguments: z.array(z.string()).min(1).max(5),
  evidence: z.array(z.string()).min(1).max(5),
  confidence: z.number().min(0).max(1),
}

export const newsPassSchema = z.object({
  ...commonAnalystFields,
  sentimentSummary: z.string(),
})

export const fundamentalPassSchema = z.object({
  ...commonAnalystFields,
  businessQuality: z.string(),
  financialTrend: z.string(),
  valuationSanityCheck: z.string(),
  valuationSummary: z.string(),
})

export const technicalPassSchema = z.object({
  ...commonAnalystFields,
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

export const sentimentPassSchema = z.object({
  ...commonAnalystFields,
  sentimentScore: z.number().min(-100).max(100),
  sentimentSummary: z.string(),
})

export const macroPassSchema = z.object({
  ...commonAnalystFields,
  regimeAssessment: z.string(),
  macroSummary: z.string(),
})

export const analystPassOutputSchema = z.object({
  news: newsPassSchema,
  fundamental: fundamentalPassSchema,
  technical: technicalPassSchema,
  sentiment: sentimentPassSchema,
  macro: macroPassSchema,
})

export type AnalystPassInput = z.infer<typeof analystPassInputSchema>
export type AnalystPassOutput = z.infer<typeof analystPassOutputSchema>
export type NewsPassOutput = z.infer<typeof newsPassSchema>
export type FundamentalPassOutput = z.infer<typeof fundamentalPassSchema>
export type TechnicalPassOutput = z.infer<typeof technicalPassSchema>
export type SentimentPassOutput = z.infer<typeof sentimentPassSchema>
export type MacroPassOutput = z.infer<typeof macroPassSchema>
