import { describe, it, expect } from "vitest"
import { bearResearcherInputSchema, bearResearcherOutputSchema } from "@/agents/bear-researcher/schema"

describe("Bear Researcher Schema", () => {
  const thesis = { ticker: "AAPL", direction: "BEARISH" as const, thesis: "Strong sell case", confidence: 0.7, keyPoints: ["Point 1"] }
  const reports = [{ agentId: "n1", agentName: "News", position: "OPPOSE" as const, arguments: ["Bad news"], evidence: ["Headline"], confidence: 0.8 }]

  it("accepts valid input", () => {
    expect(bearResearcherInputSchema.safeParse({ ticker: "AAPL", thesis, analystReports: reports, round: 1 }).success).toBe(true)
  })
  it("accepts valid output", () => {
    expect(bearResearcherOutputSchema.safeParse({
      agentId: "bear-researcher", agentName: "空方研究員", position: "OPPOSE",
      arguments: ["Negative outlook supports bear case"], evidence: ["Headline: Revenue miss"],
      confidence: 0.8, keyBearThemes: ["Slowing demand"], bearishScore: 80, summary: "空方信號強勁",
    }).success).toBe(true)
  })
  it("rejects bearishScore out of range", () => {
    expect(bearResearcherOutputSchema.safeParse({
      agentId: "b", agentName: "B", position: "OPPOSE", arguments: ["x"], evidence: ["x"],
      confidence: 0.5, keyBearThemes: ["x"], bearishScore: -10, summary: "x",
    }).success).toBe(false)
  })
})
