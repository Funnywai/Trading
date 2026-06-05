import { describe, it, expect } from "vitest"
import { bullResearcherInputSchema, bullResearcherOutputSchema } from "@/agents/bull-researcher/schema"

describe("Bull Researcher Schema", () => {
  const thesis = { ticker: "AAPL", direction: "BULLISH" as const, thesis: "Strong buy case", confidence: 0.7, keyPoints: ["Point 1"] }
  const reports = [{ agentId: "n1", agentName: "News", position: "SUPPORT" as const, arguments: ["Good news"], evidence: ["Headline"], confidence: 0.8 }]

  it("accepts valid input", () => {
    expect(bullResearcherInputSchema.safeParse({ ticker: "AAPL", thesis, analystReports: reports, round: 1 }).success).toBe(true)
  })
  it("accepts valid output", () => {
    expect(bullResearcherOutputSchema.safeParse({
      agentId: "bull-researcher", agentName: "多方研究員", position: "SUPPORT",
      arguments: ["News supports bullish thesis"], evidence: ["Headline: Earnings beat"],
      confidence: 0.8, keyBullThemes: ["AI demand"], bullishScore: 75, summary: "多方信號強勁",
    }).success).toBe(true)
  })
  it("rejects bullishScore out of range", () => {
    expect(bullResearcherOutputSchema.safeParse({
      agentId: "b", agentName: "B", position: "SUPPORT", arguments: ["x"], evidence: ["x"],
      confidence: 0.5, keyBullThemes: ["x"], bullishScore: 150, summary: "x",
    }).success).toBe(false)
  })
})
