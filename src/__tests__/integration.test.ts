import { describe, it, expect } from "vitest"
import { mainThesisOutputSchema } from "@/agents/main/schema"
import { newsPassSchema, fundamentalPassSchema } from "@/agents/analyst-pass/schema"
import { riskAgentOutputSchema } from "@/agents/risk/schema"
import { mainJudgmentInputSchema } from "@/agents/main/schema"
import { debateResultSchema } from "@/schemas"
import { computeAllRiskMetrics } from "@/risk/metrics"

describe("Debate Pipeline Integration", () => {
  const samplePrices = [100, 101, 103, 102, 105, 107, 106, 108, 110, 109]

  it("thesis output feeds into news agent input via schema compatibility", () => {
    const thesis = {
      ticker: "AAPL",
      direction: "BULLISH" as const,
      thesis: "Strong buy case with solid fundamentals",
      confidence: 0.7,
      keyPoints: ["Strong revenue growth", "Market leadership"],
    }

    expect(mainThesisOutputSchema.safeParse(thesis).success).toBe(true)
  })

  it("news and fundamental outputs are valid AgentArgument sources", () => {
    const newsOutput = {
      agentId: "news-agent",
      agentName: "News Agent",
      position: "SUPPORT" as const,
      arguments: ["Recent earnings beat supports bullish thesis"],
      evidence: ["Q4 EPS: $2.10 vs $1.95 expected"],
      confidence: 0.8,
      sentimentSummary: "Positive sentiment",
    }

    const fundamentalOutput = {
      agentId: "fundamental-agent",
      agentName: "Fundamental Agent",
      position: "OPPOSE" as const,
      arguments: ["PE ratio of 35 is above industry average of 25"],
      evidence: ["PE: 35", "Industry PE: 25"],
      confidence: 0.75,
      businessQuality: "Strong brand but challenged growth",
      financialTrend: "Revenue growth decelerating",
      valuationSanityCheck: "PE 35 vs industry 25, overvalued",
      valuationSummary: "Overvalued relative to peers",
    }

    expect(newsPassSchema.safeParse(newsOutput).success).toBe(true)
    expect(fundamentalPassSchema.safeParse(fundamentalOutput).success).toBe(true)
  })

  it("risk assessment is valid for judgment input", () => {
    const riskOutput = {
      agentId: "risk-agent",
      agentName: "Risk Agent",
      maxPositionSize: 10000,
      suggestedStopLoss: 175,
      portfolioImpact: "Low impact",
      warnings: ["Tech sector concentration"],
      riskScore: 40,
    }

    expect(riskAgentOutputSchema.safeParse(riskOutput).success).toBe(true)
  })

  it("main judgment input schema accepts full debate structure", () => {
    const judgmentInput = {
      ticker: "AAPL",
      currentPrice: 190,
      thesis: {
        ticker: "AAPL",
        direction: "BULLISH" as const,
        thesis: "Strong buy case",
        confidence: 0.7,
        keyPoints: ["Key point 1"],
      },
      rounds: [
        {
          round: 1,
          arguments: [
            {
              agentId: "news-agent",
              agentName: "News Agent",
              position: "SUPPORT" as const,
              arguments: ["News supports thesis"],
              evidence: ["Headline: Apple beats estimates"],
              confidence: 0.8,
            },
            {
              agentId: "fundamental-agent",
              agentName: "Fundamental Agent",
              position: "OPPOSE" as const,
              arguments: ["Valuation is stretched"],
              evidence: ["PE: 35", "Industry PE: 25"],
              confidence: 0.7,
            },
          ],
        },
      ],
      riskAssessment: {
        maxPositionSize: 10000,
        suggestedStopLoss: 170,
        portfolioImpact: "Low impact",
        warnings: ["Tech exposure"],
        riskScore: 40,
      },
      verifierReport: {
        unsupportedClaims: [],
        duplicatedEvidenceIds: [],
        evidenceCoverageScore: 85,
        canProceedToFinal: true,
        summary: "Evidence is sufficient",
      },
      holdsThisTicker: true,
    }

    expect(mainJudgmentInputSchema.safeParse(judgmentInput).success).toBe(true)
  })

  it("debateResultSchema validates full result", () => {
    const result = {
      ticker: "AAPL",
      currentPrice: 190,
      thesis: {
        ticker: "AAPL",
        direction: "BULLISH" as const,
        thesis: "Strong buy case",
        confidence: 0.7,
        keyPoints: ["Point 1"],
      },
      rounds: [
        {
          round: 1,
          thesis: {
            ticker: "AAPL",
            direction: "BULLISH" as const,
            thesis: "Strong buy case",
            confidence: 0.7,
            keyPoints: ["Point 1"],
          },
          arguments: [
            {
              agentId: "news-agent",
              agentName: "News Agent",
              position: "SUPPORT" as const,
              arguments: ["Argument 1"],
              evidence: ["Evidence 1"],
              confidence: 0.8,
            },
            {
              agentId: "fundamental-agent",
              agentName: "Fundamental Agent",
              position: "NEUTRAL" as const,
              arguments: ["Argument 1"],
              evidence: ["Evidence 1"],
              confidence: 0.6,
            },
          ],
        },
      ],
      riskAssessment: {
        maxPositionSize: 10000,
        suggestedStopLoss: 170,
        portfolioImpact: "Low",
        warnings: [],
        riskScore: 30,
      },
      judgment: {
        ticker: "AAPL",
        action: "ADD_SMALL" as const,
        conviction: 0.8,
        rationale: "Strong case",
        debateSummary: "News supported, fundamentals neutral",
        bullSummary: ["Strong revenue"],
        bearSummary: ["High PE"],
        keyEvidenceIds: ["ev-1"],
        evidenceStrength: "MODERATE" as const,
        disagreementLevel: "LOW" as const,
        dataQualityWarning: [],
        entryPrice: 185,
        stopLoss: 170,
        positionSizePercent: 10,
        invalidationConditions: ["Revenue drops below 10%"],
        nextReviewTrigger: "Next month",
      },
      totalTokensUsed: 5000,
      durationMs: 15000,
    }

    expect(debateResultSchema.safeParse(result).success).toBe(true)
  })

  it("computeAllRiskMetrics continues to work", () => {
    const metrics = computeAllRiskMetrics(samplePrices)
    expect(metrics.sharpeRatio).toBeDefined()
    expect(metrics.var95).toBeGreaterThanOrEqual(0)
  })
})
