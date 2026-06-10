import { z } from "zod"

export const directionSchema = z.enum(["BULLISH", "BEARISH"])
export const actionSchema = z.enum(["BUY", "SELL", "HOLD"])
export const decisionActionSchema = z.enum(["ADD_SMALL", "HOLD", "REDUCE", "EXIT", "OBSERVE", "NO_ACTION"])
export const positionSchema = z.enum(["SUPPORT", "OPPOSE", "NEUTRAL"])
export const sentimentSchema = z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL"])
export const evidenceStrengthSchema = z.enum(["WEAK", "MODERATE", "STRONG"])
export const disagreementLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"])
export const dataFreshnessSchema = z.enum(["fresh", "delayed", "stale"])

export const priceBarSchema = z.object({
  date: z.string(), open: z.number().positive(), high: z.number().positive(),
  low: z.number().positive(), close: z.number().positive(), volume: z.number().nonnegative(),
})

export const riskMetricsSchema = z.object({
  var95: z.number(), var99: z.number(), cvar95: z.number(),
  sharpeRatio: z.number(), sortinoRatio: z.number(), maxDrawdown: z.number(),
  volatility: z.number(), beta: z.number(), alpha: z.number(),
  trackingError: z.number(), informationRatio: z.number(),
})

export const newsArticleSchema = z.object({
  headline: z.string(), summary: z.string(), source: z.string(),
  url: z.string(), publishedAt: z.string(), sentiment: sentimentSchema.optional(),
})

export const fundamentalDataSchema = z.object({
  ticker: z.string(), peRatio: z.number().nullable(), pbRatio: z.number().nullable(),
  eps: z.number().nullable(), revenueGrowth: z.number().nullable(),
  profitMargin: z.number().nullable(), debtToEquity: z.number().nullable(),
  roe: z.number().nullable(), currentRatio: z.number().nullable(),
  marketCap: z.number().nullable(), dividendYield: z.number().nullable(),
})

export const thesisSchema = z.object({
  ticker: z.string(), direction: directionSchema, thesis: z.string(),
  confidence: z.number().min(0).max(1), keyPoints: z.array(z.string()).max(5),
})

export const agentArgumentSchema = z.object({
  agentId: z.string(), agentName: z.string(), position: positionSchema,
  arguments: z.array(z.string()), evidence: z.array(z.string()),
  confidence: z.number().min(0).max(1),
})

export const debateRoundSchema = z.object({
  round: z.number().int().positive(), thesis: thesisSchema,
  arguments: z.array(agentArgumentSchema),
})

export const riskAssessmentSchema = z.object({
  maxPositionSize: z.number().nonnegative(), suggestedStopLoss: z.number().positive(),
  portfolioImpact: z.string(), warnings: z.array(z.string()), riskScore: z.number().min(0).max(100),
})

export const evidenceGateOutputSchema = z.object({
  unsupportedClaims: z.array(z.string()),
  temporalMismatches: z.array(z.string()),
  metricMismatches: z.array(z.string()),
  duplicatedEvidenceIds: z.array(z.string()),
  evidenceCoverageScore: z.number().min(0).max(100),
  counterEvidenceCoverage: z.number().min(0).max(100),
  canProceedToFinal: z.boolean(),
  summary: z.string(),
})

export const finalJudgmentSchema = z.object({
  ticker: z.string(),
  action: decisionActionSchema,
  conviction: z.number().min(0).max(1),
  rationale: z.string(),
  debateSummary: z.string(),
  bullSummary: z.array(z.string()).max(5),
  bearSummary: z.array(z.string()).max(5),
  keyEvidenceIds: z.array(z.string()),
  evidenceStrength: evidenceStrengthSchema,
  disagreementLevel: disagreementLevelSchema,
  dataQualityWarning: z.array(z.string()),
  entryPrice: z.number().positive().nullable().optional(),
  targetPrice: z.number().positive().nullable().optional(),
  stopLoss: z.number().positive().nullable().optional(),
  positionSizePercent: z.number().min(0).max(100).nullable().optional(),
  invalidationConditions: z.array(z.string()).max(5),
  nextReviewTrigger: z.string(),
})

export const researchMemoSchema = z.object({
  ticker: z.string(),
  direction: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
  bullCase: z.array(z.string()).max(5),
  bearCase: z.array(z.string()).max(5),
  evidenceMatrix: z.record(z.string(), z.array(z.string())),
  conviction: z.number().min(0).max(1),
  keyUncertainties: z.array(z.string()).max(5),
  nextReviewTrigger: z.string(),
  summary: z.string(),
})

export const tradeProposalSchema = z.object({
  ticker: z.string(),
  side: z.enum(["LONG", "SHORT", "NONE"]),
  action: decisionActionSchema,
  entryBand: z.object({ lower: z.number().positive(), upper: z.number().positive() }).optional(),
  stopLoss: z.number().positive().nullable().optional(),
  targetPrice: z.number().positive().nullable().optional(),
  timeHorizon: z.string(),
  maxPositionSizePct: z.number().min(0).max(100).nullable().optional(),
  sizingRationale: z.string(),
  expectedCatalysts: z.array(z.string()).max(5),
  invalidationConditions: z.array(z.string()).max(5),
  thesisId: z.string(),
})

export const approvalDecisionSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED", "RESIZED"]),
  approvedBy: z.string(),
  originalSize: z.number().optional(),
  adjustedSize: z.number().optional(),
  rejectionReasons: z.array(z.string()),
  overrideReasons: z.array(z.string()),
  approvedAt: z.string(),
})

export const debateResultSchema = z.object({
  ticker: z.string(), currentPrice: z.number().positive(),
  thesis: thesisSchema, rounds: z.array(debateRoundSchema),
  riskAssessment: riskAssessmentSchema.nullable(), judgment: finalJudgmentSchema,
  researchMemo: researchMemoSchema.optional(),
  tradeProposal: tradeProposalSchema.optional(),
  approvalDecision: approvalDecisionSchema.optional(),
  totalTokensUsed: z.number().int().nonnegative(), durationMs: z.number().int().nonnegative(),
})

export const agentRunResultSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(), data: dataSchema.optional(),
    error: z.string().optional(), tokensUsed: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
  })
