import { describe, it, expect } from "vitest"
import { fundamentalAgentInputSchema, fundamentalAgentOutputSchema } from "@/agents/fundamental/schema"

describe("Fundamental Agent Schema", () => {
  const thesis = {
    ticker: "NVDA",
    direction: "BEARISH" as const,
    thesis: "Overvalued at current levels",
    confidence: 0.6,
    keyPoints: ["High PE ratio", "Growth slowing"],
  }

  const fundamentals = {
    ticker: "NVDA",
    peRatio: 65,
    pbRatio: 25,
    eps: 12.5,
    revenueGrowth: 0.15,
    profitMargin: 0.45,
    debtToEquity: 0.3,
    roe: 0.55,
    currentRatio: 3.2,
    marketCap: 2000000000000,
    dividendYield: 0.001,
  }

  it("accepts valid input", () => {
    expect(
      fundamentalAgentInputSchema.safeParse({ ticker: "NVDA", thesis, fundamentals, round: 1 }).success
    ).toBe(true)
  })

  it("accepts null values for ratios", () => {
    expect(
      fundamentalAgentInputSchema.safeParse({
        ticker: "NVDA",
        thesis,
        fundamentals: { ...fundamentals, peRatio: null, eps: null },
        round: 1,
      }).success
    ).toBe(true)
  })

  it("accepts OPPOSE output", () => {
    expect(
      fundamentalAgentOutputSchema.safeParse({
        agentId: "fundamental-agent",
        agentName: "Fundamental Agent",
        position: "OPPOSE",
        arguments: ["PE ratio of 65 is extremely elevated"],
        evidence: ["PE: 65", "Industry avg PE: 25"],
        confidence: 0.85,
        businessQuality: "Strong brand and high margins",
        financialTrend: "Revenue growth steady at 15%",
        valuationSanityCheck: "PE 65 vs industry 25, significantly overvalued",
        valuationSummary: "Significantly overvalued",
      }).success
    ).toBe(true)
  })

  it("rejects empty arguments", () => {
    expect(
      fundamentalAgentOutputSchema.safeParse({
        agentId: "fundamental-agent",
        agentName: "Fundamental Agent",
        position: "NEUTRAL",
        arguments: [],
        evidence: ["PE: 65"],
        confidence: 0.5,
        valuationSummary: "Neutral",
      }).success
    ).toBe(false)
  })
})
