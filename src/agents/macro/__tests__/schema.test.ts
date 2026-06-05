import { describe, it, expect } from "vitest"
import { macroInputSchema, macroOutputSchema } from "@/agents/macro/schema"

describe("Macro Agent Schema", () => {
  const thesis = {
    ticker: "AAPL",
    direction: "BULLISH" as const,
    thesis: "Strong fundamentals",
    confidence: 0.7,
    keyPoints: ["Point 1"],
  }

  const macroData = {
    spyChange: 0.5,
    qqqChange: 0.8,
    vixLevel: 18,
    us10y: 4.2,
    dxy: 103,
    oil: 78,
    marketRegime: "RISK_ON" as const,
    sectorRotation: "Technology leading",
  }

  it("accepts valid input", () => {
    expect(
      macroInputSchema.safeParse({ ticker: "AAPL", thesis, macroData, round: 1 }).success
    ).toBe(true)
  })

  it("rejects missing macroData", () => {
    expect(
      macroInputSchema.safeParse({ ticker: "AAPL", thesis, round: 1 }).success
    ).toBe(false)
  })

  it("rejects invalid marketRegime", () => {
    expect(
      macroInputSchema.safeParse({
        ticker: "AAPL",
        thesis,
        macroData: { ...macroData, marketRegime: "UNKNOWN" },
        round: 1,
      }).success
    ).toBe(false)
  })

  it("rejects invalid round", () => {
    expect(
      macroInputSchema.safeParse({ ticker: "AAPL", thesis, macroData, round: 0 }).success
    ).toBe(false)
  })

  it("accepts SUPPORT output", () => {
    expect(
      macroOutputSchema.safeParse({
        agentId: "macro-agent",
        agentName: "宏觀分析代理人",
        position: "SUPPORT",
        arguments: ["VIX 低於 20，顯示市場風險偏好較高"],
        evidence: ["VIX 在 18，低於 20 恐慌線"],
        confidence: 0.8,
        regimeAssessment: "目前市場處於 RISK_ON 狀態，有利於科技股。",
        macroSummary: "整體宏觀環境支持成長型股票。",
      }).success
    ).toBe(true)
  })

  it("accepts OPPOSE output with high VIX", () => {
    expect(
      macroOutputSchema.safeParse({
        agentId: "macro-agent",
        agentName: "宏觀分析代理人",
        position: "OPPOSE",
        arguments: ["VIX 高於 25，市場風險升高"],
        evidence: ["VIX 在 28，突破恐慌門檻"],
        confidence: 0.7,
        regimeAssessment: "RISK_OFF 環境，建議降低風險敞口。",
        macroSummary: "宏觀環境不利，建議謹慎。",
      }).success
    ).toBe(true)
  })

  it("rejects invalid position", () => {
    expect(
      macroOutputSchema.safeParse({
        agentId: "macro-agent",
        agentName: "宏觀分析代理人",
        position: "STRONG_SELL",
        arguments: ["Test"],
        evidence: ["Test"],
        confidence: 0.5,
        regimeAssessment: "OK",
        macroSummary: "OK",
      }).success
    ).toBe(false)
  })

  it("rejects empty evidence", () => {
    expect(
      macroOutputSchema.safeParse({
        agentId: "macro-agent",
        agentName: "宏觀分析代理人",
        position: "NEUTRAL",
        arguments: ["Test"],
        evidence: [],
        confidence: 0.5,
        regimeAssessment: "OK",
        macroSummary: "OK",
      }).success
    ).toBe(false)
  })
})
