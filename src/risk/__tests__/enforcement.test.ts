import { describe, it, expect } from "vitest"
import { enforceDecisionPolicy } from "@/risk/enforcement"
import { FinalJudgment, DataQuality, EvidenceGateOutput, RiskAssessment } from "@/types"
import { ConcentrationReport } from "@/risk/concentration"

function baseJudgment(overrides: Partial<FinalJudgment> = {}): FinalJudgment {
  return {
    ticker: "AAPL",
    action: "ADD_SMALL",
    conviction: 0.8,
    rationale: "Strong case",
    debateSummary: "All agents support",
    bullSummary: ["Strong revenue growth"],
    bearSummary: ["High valuation"],
    keyEvidenceIds: ["ev-1"],
    evidenceStrength: "STRONG",
    disagreementLevel: "LOW",
    dataQualityWarning: [],
    entryPrice: 185,
    stopLoss: 170,
    positionSizePercent: 10,
    invalidationConditions: ["Revenue drops below 10%"],
    nextReviewTrigger: "One month",
    ...overrides,
  }
}

function goodDataQuality(overrides: Partial<DataQuality> = {}): DataQuality {
  return { newsCount: 8, missingFundamentalFields: [], staleFlags: [], qualityScore: 85, ...overrides }
}

function passingVerifier(overrides: Partial<EvidenceGateOutput> = {}): EvidenceGateOutput {
  return {
    unsupportedClaims: [],
    temporalMismatches: [],
    metricMismatches: [],
    duplicatedEvidenceIds: [],
    evidenceCoverageScore: 85,
    counterEvidenceCoverage: 50,
    canProceedToFinal: true,
    summary: "Evidence sufficient",
    ...overrides,
  }
}

function lowRiskAssessment(overrides: Partial<RiskAssessment> = {}): RiskAssessment {
  return {
    maxPositionSize: 10000,
    suggestedStopLoss: 170,
    portfolioImpact: "Low",
    warnings: [],
    riskScore: 30,
    ...overrides,
  }
}

function lowConcentration(overrides: Partial<ConcentrationReport> = {}): ConcentrationReport {
  return {
    singleStockRisk: { maxAllocation: 0.15, maxTicker: "MSFT", isConcentrated: false, warning: null },
    top3Concentration: 0.4,
    sectorExposure: { Technology: 0.3 },
    sectorWarnings: [],
    correlationClusterRisk: "LOW",
    overallConcentrationScore: 80,
    ...overrides,
  }
}

describe("enforceDecisionPolicy", () => {
  describe("no-trigger passthrough", () => {
    it("returns unchanged judgment when all guards pass", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment(),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: lowRiskAssessment(),
        concentration: lowConcentration(),
      })
      expect(result.action).toBe("ADD_SMALL")
      expect(result.conviction).toBe(0.8)
      expect(result.positionSizePercent).toBe(10)
    })

    it("passes through HOLD without changing", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ action: "HOLD", conviction: 0.5 }),
        dataQuality: goodDataQuality({ qualityScore: 35 }),
        verifierReport: null,
        riskAssessment: null,
        concentration: null,
      })
      expect(result.action).toBe("OBSERVE") // qualityScore < 40 forces OBSERVE
    })
  })

  describe("quality gate", () => {
    it("forces OBSERVE when qualityScore < 40", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment(),
        dataQuality: goodDataQuality({ qualityScore: 25 }),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: null,
      })
      expect(result.action).toBe("OBSERVE")
      expect(result.conviction).toBeLessThanOrEqual(0.15)
      expect(result.dataQualityWarning.some((w) => w.includes("data_quality_too_low"))).toBe(true)
    })

    it("does not downgrade when qualityScore = 50", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment(),
        dataQuality: goodDataQuality({ qualityScore: 50 }),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: null,
      })
      expect(result.action).toBe("ADD_SMALL")
    })
  })

  describe("verifier gate", () => {
    it("forces OBSERVE when canProceedToFinal is false", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment(),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier({ canProceedToFinal: false, evidenceCoverageScore: 35 }),
        riskAssessment: null,
        concentration: null,
      })
      expect(result.action).toBe("OBSERVE")
      expect(result.dataQualityWarning.some((w) => w.includes("verifier_blocked"))).toBe(true)
    })

    it("forces OBSERVE when evidenceCoverageScore < 25", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment(),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier({ evidenceCoverageScore: 20 }),
        riskAssessment: null,
        concentration: null,
      })
      expect(result.action).toBe("OBSERVE")
      expect(result.dataQualityWarning.some((w) => w.includes("evidence_coverage_too_low"))).toBe(true)
    })

    it("caps position size instead of banning when coverage 25-40", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ positionSizePercent: 10 }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier({ evidenceCoverageScore: 35 }),
        riskAssessment: null,
        concentration: null,
      })
      expect(result.action).toBe("ADD_SMALL")
      expect(result.positionSizePercent).toBe(2)
      expect(result.dataQualityWarning.some((w) => w.includes("capped_to_2pct"))).toBe(true)
    })
  })

  describe("evidence strength gate", () => {
    it("caps position size instead of banning when evidenceStrength is WEAK", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ evidenceStrength: "WEAK", positionSizePercent: 10 }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: null,
      })
      expect(result.action).toBe("ADD_SMALL")
      expect(result.positionSizePercent).toBe(2)
      expect(result.dataQualityWarning.some((w) => w.includes("weak_evidence_capped"))).toBe(true)
    })
  })

  describe("risk gate", () => {
    it("downgrades ADD_SMALL to HOLD when riskScore >= 75", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment(),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: lowRiskAssessment({ riskScore: 78 }),
        concentration: lowConcentration(),
      })
      expect(result.action).toBe("HOLD")
      expect(result.conviction).toBeCloseTo(0.4)
    })

    it("caps position size when riskScore 60-74", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ positionSizePercent: 10 }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: lowRiskAssessment({ riskScore: 65 }),
        concentration: lowConcentration(),
      })
      expect(result.action).toBe("ADD_SMALL")
      expect(result.positionSizePercent).toBe(3)
      expect(result.dataQualityWarning.some((w) => w.includes("elevated_risk_capped"))).toBe(true)
    })

    it("forces OBSERVE when riskScore > 85", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ action: "HOLD" }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: lowRiskAssessment({ riskScore: 92 }),
        concentration: null,
      })
      expect(result.action).toBe("OBSERVE")
      expect(result.dataQualityWarning.some((w) => w.includes("extreme_risk"))).toBe(true)
    })
  })

  describe("concentration gate", () => {
    it("downgrades ADD_SMALL to HOLD when concentration score < 50", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment(),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: lowConcentration({ overallConcentrationScore: 35 }),
      })
      expect(result.action).toBe("HOLD")
      expect(result.dataQualityWarning.some((w) => w.includes("high_concentration"))).toBe(true)
    })

    it("caps position size when portfolio is concentrated", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ action: "HOLD", positionSizePercent: 15 }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: lowConcentration({
          singleStockRisk: { maxAllocation: 0.4, maxTicker: "AAPL", isConcentrated: true, warning: "Concentrated" },
        }),
      })
      expect(result.positionSizePercent).toBe(5)
      expect(result.dataQualityWarning.some((w) => w.includes("concentrated_portfolio_caps"))).toBe(true)
    })
  })

  describe("disagreement gate", () => {
    it("caps position size instead of banning when disagreement is HIGH", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ disagreementLevel: "HIGH", positionSizePercent: 10 }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: null,
      })
      expect(result.action).toBe("ADD_SMALL")
      expect(result.positionSizePercent).toBe(2)
      expect(result.dataQualityWarning.some((w) => w.includes("high_disagreement_capped"))).toBe(true)
    })
  })

  describe("null safety", () => {
    it("handles null verifier gracefully", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment(),
        dataQuality: goodDataQuality(),
        verifierReport: null,
        riskAssessment: null,
        concentration: null,
      })
      expect(result.action).toBe("ADD_SMALL")
    })

    it("handles null risk assessment gracefully", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ evidenceStrength: "STRONG" }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: null,
      })
      expect(result.action).toBe("ADD_SMALL")
    })
  })

  describe("dataQualityWarning accumulation", () => {
    it("preserves existing warnings and adds enforcement warnings", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ dataQualityWarning: ["existing_warning"] }),
        dataQuality: goodDataQuality({ qualityScore: 25 }),
        verifierReport: null,
        riskAssessment: null,
        concentration: null,
      })
      expect(result.dataQualityWarning).toContain("existing_warning")
      expect(result.dataQualityWarning.some((w) => w.includes("data_quality_too_low"))).toBe(true)
    })
  })

  describe("holding-awareness gate", () => {
    it("forces OBSERVE when non-holder outputs HOLD", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ action: "HOLD" }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: null,
        holdsTicker: false,
      })
      expect(result.action).toBe("OBSERVE")
      expect(result.dataQualityWarning.some((w) => w.includes("action_requires_holding"))).toBe(true)
    })

    it("forces OBSERVE when non-holder outputs REDUCE", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ action: "REDUCE" }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: null,
        holdsTicker: false,
      })
      expect(result.action).toBe("OBSERVE")
    })

    it("forces OBSERVE when non-holder outputs EXIT", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ action: "EXIT" }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: null,
        holdsTicker: false,
      })
      expect(result.action).toBe("OBSERVE")
    })

    it("allows ADD_SMALL when non-holder", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ action: "ADD_SMALL" }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: null,
        holdsTicker: false,
      })
      expect(result.action).toBe("ADD_SMALL")
    })

    it("allows OBSERVE when non-holder", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ action: "OBSERVE" }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: null,
        holdsTicker: false,
      })
      expect(result.action).toBe("OBSERVE")
    })

    it("defaults holdsTicker to true (backward compat)", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ action: "HOLD" }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: null,
      })
      expect(result.action).toBe("HOLD")
    })

    it("forces HOLD when holder receives OBSERVE", () => {
      const result = enforceDecisionPolicy({
        judgment: baseJudgment({ action: "OBSERVE" }),
        dataQuality: goodDataQuality(),
        verifierReport: passingVerifier(),
        riskAssessment: null,
        concentration: null,
        holdsTicker: true,
      })
      expect(result.action).toBe("HOLD")
      expect(result.dataQualityWarning.some((w) => w.includes("holder_should_not_observe"))).toBe(true)
    })
  })
})
