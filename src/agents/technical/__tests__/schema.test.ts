import { describe, it, expect } from "vitest"
import { technicalAgentInputSchema, technicalAgentOutputSchema } from "@/agents/technical/schema"

describe("Technical Agent Schema", () => {
  const thesis = {
    ticker: "AAPL", direction: "BULLISH" as const,
    thesis: "Strong trend", confidence: 0.7, keyPoints: ["Momentum strong"],
  }
  const bars = [{ date: "2024-01-01", open: 180, high: 185, low: 179, close: 184, volume: 50000000 }]

  it("accepts valid input", () => {
    expect(technicalAgentInputSchema.safeParse({ ticker: "AAPL", thesis, priceBars: bars, round: 1 }).success).toBe(true)
  })

  it("accepts input with opponent arguments", () => {
    expect(technicalAgentInputSchema.safeParse({ ticker: "AAPL", thesis, priceBars: bars, opponentArguments: "News agent says PE high", round: 2 }).success).toBe(true)
  })

  it("accepts valid output with entry zone", () => {
    expect(technicalAgentOutputSchema.safeParse({
      agentId: "technical-agent", agentName: "技術分析代理人",
      position: "SUPPORT", arguments: ["突破 $190 阻力位"], evidence: ["50MA: $185"],
      confidence: 0.75, trend: "BULLISH", setupQuality: 65,
      entryZone: { lower: 188, upper: 192 }, stopLogic: "$180 之下",
      invalidations: ["跌破 $180"], technicalSummary: "強勢突破",
    }).success).toBe(true)
  })

  it("accepts output without entry zone when setup quality is low", () => {
    expect(technicalAgentOutputSchema.safeParse({
      agentId: "technical-agent", agentName: "技術分析代理人",
      position: "NEUTRAL", arguments: ["無明確趨勢"], evidence: ["價格於 $180-$190 盤整"],
      confidence: 0.4, trend: "NEUTRAL", setupQuality: 25,
      invalidations: [], technicalSummary: "盤整格局",
    }).success).toBe(true)
  })

  it("rejects setupQuality out of range", () => {
    expect(technicalAgentOutputSchema.safeParse({
      agentId: "t", agentName: "T", position: "NEUTRAL",
      arguments: ["x"], evidence: ["x"], confidence: 0.5,
      trend: "NEUTRAL", setupQuality: 150, invalidations: [], technicalSummary: "x",
    }).success).toBe(false)
  })
})
