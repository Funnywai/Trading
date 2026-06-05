import { describe, it, expect } from "vitest"
import { riskAgentInputSchema, riskAgentOutputSchema } from "@/agents/risk/schema"

describe("Risk Agent Schema", () => {
  const thesis = {
    ticker: "AAPL",
    direction: "BULLISH" as const,
    thesis: "Strong buy case",
    confidence: 0.7,
    keyPoints: ["Good fundamentals"],
  }

  const portfolio = {
    totalValue: 100000,
    holdings: [
      { ticker: "MSFT", allocation: 0.4 },
      { ticker: "GOOGL", allocation: 0.35 },
    ],
    cashRatio: 0.25,
  }

  it("accepts valid input with risk metrics", () => {
    expect(
      riskAgentInputSchema.safeParse({
        ticker: "AAPL",
        thesis,
        portfolio,
        riskMetrics: { var95: 0.03, var99: 0.05, cvar95: 0.04, sharpeRatio: 1.2, sortinoRatio: 1.5, maxDrawdown: 0.15, volatility: 0.2, beta: 1.1, alpha: 0.05, trackingError: 0.08, informationRatio: 0.6 },
      }).success
    ).toBe(true)
  })

  it("accepts input without risk metrics", () => {
    expect(
      riskAgentInputSchema.safeParse({ ticker: "AAPL", thesis, portfolio }).success
    ).toBe(true)
  })

  it("rejects risk score > 100", () => {
    expect(
      riskAgentOutputSchema.safeParse({
        agentId: "risk-agent",
        agentName: "Risk Agent",
        maxPositionSize: 5000,
        suggestedStopLoss: 170,
        portfolioImpact: "Low impact",
        warnings: ["Concentration risk"],
        riskScore: 150,
      }).success
    ).toBe(false)
  })

  it("accepts valid output", () => {
    expect(
      riskAgentOutputSchema.safeParse({
        agentId: "risk-agent",
        agentName: "Risk Agent",
        maxPositionSize: 10000,
        suggestedStopLoss: 175,
        portfolioImpact: "Adding AAPL at 10% would diversify tech holdings",
        warnings: ["Existing tech exposure at 75%"],
        riskScore: 35,
      }).success
    ).toBe(true)
  })
})
