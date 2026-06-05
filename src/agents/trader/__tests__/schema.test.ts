import { describe, it, expect } from "vitest"
import { traderInputSchema, traderOutputSchema } from "@/agents/trader/schema"

describe("Trader Schema", () => {
  const thesis = { ticker: "AAPL", direction: "BULLISH" as const, thesis: "Strong buy case", confidence: 0.7, keyPoints: ["Point 1"] }
  const memo = {
    ticker: "AAPL", direction: "BULLISH" as const,
    bullCase: ["AI demand"], bearCase: ["Valuation risk"],
    evidenceMatrix: { "News Agent": ["Revenue +5%"] },
    conviction: 0.7, keyUncertainties: ["Macro slowdown"],
    nextReviewTrigger: "After Q2", summary: "多方信號略佔優勢。",
  }
  const risk = { maxPositionSize: 10, riskScore: 35, warnings: ["Moderate volatility"] }

  it("accepts valid input with risk assessment", () => {
    expect(traderInputSchema.safeParse({
      ticker: "AAPL", thesis, researchMemo: memo, riskAssessment: risk, holdsThisTicker: false,
    }).success).toBe(true)
  })

  it("accepts valid input with null risk assessment", () => {
    expect(traderInputSchema.safeParse({
      ticker: "AAPL", thesis, researchMemo: memo, riskAssessment: null, holdsThisTicker: true,
    }).success).toBe(true)
  })

  it("accepts valid LONG output", () => {
    expect(traderOutputSchema.safeParse({
      ticker: "AAPL", side: "LONG", action: "ADD_SMALL",
      entryBand: { lower: 180, upper: 190 }, stopLoss: 170, targetPrice: 220,
      timeHorizon: "3-6 months", maxPositionSizePct: 5,
      sizingRationale: "Conviction 0.7, controlled risk",
      expectedCatalysts: ["Q2 earnings beat"], invalidationConditions: ["Revenue miss in Q2"],
      thesisId: "AAPL",
    }).success).toBe(true)
  })

  it("accepts valid NONE output without entry fields", () => {
    expect(traderOutputSchema.safeParse({
      ticker: "AAPL", side: "NONE", action: "OBSERVE",
      timeHorizon: "N/A",
      sizingRationale: "Insufficient conviction",
      expectedCatalysts: [],
      invalidationConditions: [],
      thesisId: "AAPL",
    }).success).toBe(true)
  })

  it("rejects invalid side", () => {
    expect(traderOutputSchema.safeParse({
      ticker: "AAPL", side: "BUY", action: "HOLD",
      timeHorizon: "N/A", sizingRationale: "n/a",
      expectedCatalysts: [], invalidationConditions: [], thesisId: "AAPL",
    }).success).toBe(false)
  })
})
