import { describe, it, expect } from "vitest"
import {
  mainThesisInputSchema,
  mainThesisOutputSchema,
  mainJudgmentOutputSchema,
} from "@/agents/main/schema"

describe("Main Agent Schema", () => {
  describe("Thesis Input", () => {
    it("accepts valid input", () => {
      expect(
        mainThesisInputSchema.safeParse({
          ticker: "AAPL",
          currentPrice: 190,
          fundamentalsSummary: "PE=30, ROE=150%",
        }).success
      ).toBe(true)
    })

    it("rejects missing ticker", () => {
      expect(
        mainThesisInputSchema.safeParse({ currentPrice: 100 }).success
      ).toBe(false)
    })

    it("rejects negative price", () => {
      expect(
        mainThesisInputSchema.safeParse({ ticker: "AAPL", currentPrice: -1 }).success
      ).toBe(false)
    })
  })

  describe("Thesis Output", () => {
    it("accepts valid thesis", () => {
      expect(
        mainThesisOutputSchema.safeParse({
          ticker: "AAPL",
          direction: "BULLISH",
          thesis: "Strong buy case",
          confidence: 0.7,
          keyPoints: ["Point 1", "Point 2"],
        }).success
      ).toBe(true)
    })

    it("rejects confidence > 1", () => {
      expect(
        mainThesisOutputSchema.safeParse({
          ticker: "AAPL",
          direction: "BULLISH",
          thesis: "Test",
          confidence: 1.5,
          keyPoints: [],
        }).success
      ).toBe(false)
    })

    it("rejects more than 5 key points", () => {
      expect(
        mainThesisOutputSchema.safeParse({
          ticker: "AAPL",
          direction: "BULLISH",
          thesis: "Test",
          confidence: 0.5,
          keyPoints: ["1", "2", "3", "4", "5", "6"],
        }).success
      ).toBe(false)
    })
  })

  describe("Judgment Output", () => {
    it("accepts valid judgment with all fields", () => {
      expect(
        mainJudgmentOutputSchema.safeParse({
          ticker: "AAPL",
          action: "ADD_SMALL",
          conviction: 0.85,
          rationale: "Strong evidence from debate",
          debateSummary: "Both agents supported thesis",
          bullSummary: ["Strong revenue growth"],
          bearSummary: ["High valuation"],
          keyEvidenceIds: ["ev-1"],
          evidenceStrength: "STRONG",
          disagreementLevel: "LOW",
          dataQualityWarning: [],
          entryPrice: 185,
          stopLoss: 170,
          positionSizePercent: 15,
          invalidationConditions: ["Revenue growth drops below 10%"],
          nextReviewTrigger: "Next quarter earnings",
        }).success
      ).toBe(true)
    })

    it("accepts HOLD without prices", () => {
      expect(
        mainJudgmentOutputSchema.safeParse({
          ticker: "MSFT",
          action: "HOLD",
          conviction: 0.4,
          rationale: "Mixed signals",
          debateSummary: "No consensus reached",
          bullSummary: ["Decent fundamentals"],
          bearSummary: ["No clear catalyst"],
          keyEvidenceIds: [],
          evidenceStrength: "WEAK",
          disagreementLevel: "HIGH",
          dataQualityWarning: ["limited_news"],
          invalidationConditions: [],
          nextReviewTrigger: "One week",
        }).success
      ).toBe(true)
    })
  })
})
