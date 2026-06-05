import { describe, it, expect } from "vitest"
import { researchManagerInputSchema, researchManagerOutputSchema } from "@/agents/research-manager/schema"

describe("Research Manager Schema", () => {
  const thesis = { ticker: "AAPL", direction: "BULLISH" as const, thesis: "Buy case", confidence: 0.7, keyPoints: ["Point 1"] }
  const bullCase = {
    arguments: ["AI demand growing"], evidence: ["Revenue +5% YoY"],
    keyThemes: ["AI boom"], score: 78, summary: "Strong bullish signals",
  }
  const bearCase = {
    arguments: ["Valuation stretched"], evidence: ["PE > 30"],
    keyThemes: ["Overvalued"], score: 45, summary: "Moderate bearish concerns",
  }

  it("accepts valid input without verifier report", () => {
    expect(researchManagerInputSchema.safeParse({
      ticker: "AAPL", thesis, bullCase, bearCase, verifierReport: null,
    }).success).toBe(true)
  })

  it("accepts valid input with verifier report", () => {
    expect(researchManagerInputSchema.safeParse({
      ticker: "AAPL", thesis, bullCase, bearCase,
      verifierReport: { evidenceCoverageScore: 85, canProceedToFinal: true, unsupportedClaims: [] },
    }).success).toBe(true)
  })

  it("accepts valid output matching researchMemoSchema", () => {
    expect(researchManagerOutputSchema.safeParse({
      ticker: "AAPL", direction: "BULLISH",
      bullCase: ["AI demand"], bearCase: ["Valuation risk"],
      evidenceMatrix: { "News Agent": ["Revenue +5%"] },
      conviction: 0.7, keyUncertainties: ["Macro slowdown"],
      nextReviewTrigger: "After Q2 earnings", summary: "多方信號略佔優勢，但估值偏高需謹慎。",
    }).success).toBe(true)
  })

  it("rejects output missing evidenceMatrix", () => {
    expect(researchManagerOutputSchema.safeParse({
      ticker: "AAPL", direction: "BULLISH",
      bullCase: ["x"], bearCase: ["y"],
      conviction: 0.5, keyUncertainties: ["z"],
      nextReviewTrigger: "next week", summary: "test",
    }).success).toBe(false)
  })
})
