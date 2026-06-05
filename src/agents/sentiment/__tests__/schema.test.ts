import { describe, it, expect } from "vitest"
import { sentimentInputSchema, sentimentOutputSchema } from "@/agents/sentiment/schema"

describe("Sentiment Agent Schema", () => {
  const thesis = {
    ticker: "AAPL",
    direction: "BULLISH" as const,
    thesis: "Strong fundamentals",
    confidence: 0.7,
    keyPoints: ["Point 1"],
  }

  const news = [{ headline: "Apple beats earnings", summary: "Record quarter", source: "Reuters", url: "https://example.com", publishedAt: "2024-01-01" }]

  it("accepts valid input", () => {
    expect(
      sentimentInputSchema.safeParse({ ticker: "AAPL", thesis, news, round: 1 }).success
    ).toBe(true)
  })

  it("rejects missing news", () => {
    expect(
      sentimentInputSchema.safeParse({ ticker: "AAPL", thesis, round: 1 }).success
    ).toBe(false)
  })

  it("rejects invalid round", () => {
    expect(
      sentimentInputSchema.safeParse({ ticker: "AAPL", thesis, news, round: 4 }).success
    ).toBe(false)
  })

  it("accepts SUPPORT output", () => {
    expect(
      sentimentOutputSchema.safeParse({
        agentId: "sentiment-agent",
        agentName: "社群情緒分析代理人",
        position: "SUPPORT",
        arguments: ["社群情緒整體偏多，支持多頭觀點"],
        evidence: ["bullish 文章佔 60%"],
        confidence: 0.75,
        sentimentScore: 25,
        sentimentSummary: "整體社群情緒偏向樂觀，但仍有部分擔憂。",
      }).success
    ).toBe(true)
  })

  it("accepts NEGATIVE sentimentScore", () => {
    expect(
      sentimentOutputSchema.safeParse({
        agentId: "sentiment-agent",
        agentName: "社群情緒分析代理人",
        position: "OPPOSE",
        arguments: ["多數討論為負面"],
        evidence: ["bearish 文章佔 70%"],
        confidence: 0.8,
        sentimentScore: -45,
        sentimentSummary: "情緒偏空。",
      }).success
    ).toBe(true)
  })

  it("rejects sentimentScore out of range", () => {
    expect(
      sentimentOutputSchema.safeParse({
        agentId: "sentiment-agent",
        agentName: "社群情緒分析代理人",
        position: "NEUTRAL",
        arguments: ["Test"],
        evidence: ["Test"],
        confidence: 0.5,
        sentimentScore: 120,
        sentimentSummary: "OK",
      }).success
    ).toBe(false)
  })

  it("rejects invalid position", () => {
    expect(
      sentimentOutputSchema.safeParse({
        agentId: "sentiment-agent",
        agentName: "社群情緒分析代理人",
        position: "STRONG_BUY",
        arguments: ["Test"],
        evidence: ["Test"],
        confidence: 0.5,
        sentimentScore: 0,
        sentimentSummary: "OK",
      }).success
    ).toBe(false)
  })

  it("rejects empty arguments", () => {
    expect(
      sentimentOutputSchema.safeParse({
        agentId: "sentiment-agent",
        agentName: "社群情緒分析代理人",
        position: "NEUTRAL",
        arguments: [],
        evidence: ["Test"],
        confidence: 0.5,
        sentimentScore: 0,
        sentimentSummary: "OK",
      }).success
    ).toBe(false)
  })
})
