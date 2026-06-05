import { describe, it, expect } from "vitest"
import { newsAgentInputSchema, newsAgentOutputSchema } from "@/agents/news/schema"

describe("News Agent Schema", () => {
  const thesis = {
    ticker: "AAPL",
    direction: "BULLISH" as const,
    thesis: "Strong fundamentals",
    confidence: 0.7,
    keyPoints: ["Point 1"],
  }

  const news = [
    {
      headline: "Apple beats earnings",
      summary: "Record quarter",
      source: "Reuters",
      url: "https://example.com",
      publishedAt: "2024-01-01",
      sentiment: "POSITIVE" as const,
    },
  ]

  it("accepts valid input", () => {
    expect(
      newsAgentInputSchema.safeParse({ ticker: "AAPL", thesis, news, round: 1 }).success
    ).toBe(true)
  })

  it("accepts input with opponent arguments", () => {
    expect(
      newsAgentInputSchema.safeParse({
        ticker: "AAPL",
        thesis,
        news,
        opponentArguments: "Fundamental agent argues PE is high",
        round: 2,
      }).success
    ).toBe(true)
  })

  it("rejects empty news (array is allowed by schema)", () => {
    expect(
      newsAgentInputSchema.safeParse({ ticker: "AAPL", thesis, news: [], round: 1 }).success
    ).toBe(true)
  })

  it("accepts SUPPORT output", () => {
    expect(
      newsAgentOutputSchema.safeParse({
        agentId: "news-agent",
        agentName: "News Agent",
        position: "SUPPORT",
        arguments: ["Positive earnings support the thesis"],
        evidence: ["EPS beat by 15%"],
        confidence: 0.8,
        sentimentSummary: "Positive sentiment overall",
      }).success
    ).toBe(true)
  })

  it("rejects invalid position", () => {
    expect(
      newsAgentOutputSchema.safeParse({
        agentId: "news-agent",
        agentName: "News Agent",
        position: "STRONG_BUY",
        arguments: ["Test"],
        evidence: ["Test"],
        confidence: 0.5,
        sentimentSummary: "OK",
      }).success
    ).toBe(false)
  })
})
