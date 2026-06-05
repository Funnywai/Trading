import { describe, it, expect } from "vitest"
import { verifierInputSchema, verifierOutputSchema } from "@/agents/verifier/schema"

describe("Verifier Agent Schema", () => {
  const thesis = {
    ticker: "AAPL", direction: "BULLISH" as const,
    thesis: "Strong buy case", confidence: 0.7, keyPoints: ["Point 1"],
  }

  const rounds = [{
    round: 1, arguments: [
      { agentId: "n1", agentName: "News Agent", position: "SUPPORT" as const, arguments: ["News supports thesis"], evidence: ["Headline: Apple beats estimates"], confidence: 0.8 },
      { agentId: "f1", agentName: "Fundamental Agent", position: "OPPOSE" as const, arguments: ["PE is high"], evidence: ["PE: 35"], confidence: 0.7 },
    ],
  }]

  it("accepts valid input", () => {
    expect(verifierInputSchema.safeParse({ ticker: "AAPL", thesis, rounds }).success).toBe(true)
  })

  it("accepts input with data quality", () => {
    expect(verifierInputSchema.safeParse({
      ticker: "AAPL", thesis, rounds,
      dataQuality: { newsCount: 5, missingFundamentalFields: ["D/E"], staleFlags: [], qualityScore: 70 },
    }).success).toBe(true)
  })

  it("accepts valid output", () => {
    expect(verifierOutputSchema.safeParse({
      unsupportedClaims: [], temporalMismatches: [], metricMismatches: [],
      duplicatedEvidenceIds: [],
      evidenceCoverageScore: 85, counterEvidenceCoverage: 50,
      canProceedToFinal: true,
      summary: "證據充足，可進入最終判決",
    }).success).toBe(true)
  })

  it("canProceedToFinal can be false", () => {
    expect(verifierOutputSchema.safeParse({
      unsupportedClaims: ["Lack of evidence for PE claim"],
      temporalMismatches: [], metricMismatches: [],
      duplicatedEvidenceIds: ["ev-1"],
      evidenceCoverageScore: 30, counterEvidenceCoverage: 25,
      canProceedToFinal: false,
      summary: "證據不足，中止",
    }).success).toBe(true)
  })

  it("rejects coverage score out of range", () => {
    expect(verifierOutputSchema.safeParse({
      unsupportedClaims: [], duplicatedEvidenceIds: [],
      evidenceCoverageScore: 150, canProceedToFinal: true, summary: "OK",
    }).success).toBe(false)
  })
})
