import { describe, it, expect } from "vitest"
import { generateAlerts } from "@/risk/alert-engine"
import { DataQuality, ExecutionSimResult, ApprovalDecision } from "@/types"
import { ConcentrationReport } from "@/risk/concentration"

function dq(overrides: Partial<DataQuality> = {}): DataQuality {
  return { newsCount: 8, missingFundamentalFields: [], staleFlags: [], qualityScore: 85, ...overrides }
}

describe("generateAlerts", () => {
  it("returns empty when all ok", () => {
    expect(generateAlerts({ dataQuality: dq() })).toEqual([])
  })

  it("CRITICAL on qualityScore < 40", () => {
    const alerts = generateAlerts({ dataQuality: dq({ qualityScore: 25 }) })
    expect(alerts.some((a) => a.level === "CRITICAL" && a.category === "data_quality")).toBe(true)
  })

  it("WARNING on riskScore > 70", () => {
    const alerts = generateAlerts({
      dataQuality: dq(),
      riskAssessment: { maxPositionSize: 5000, suggestedStopLoss: 100, portfolioImpact: "x", warnings: [], riskScore: 75 },
    })
    expect(alerts.some((a) => a.level === "WARNING" && a.category === "risk")).toBe(true)
  })

  it("CRITICAL on riskScore > 85", () => {
    const alerts = generateAlerts({
      dataQuality: dq(),
      riskAssessment: { maxPositionSize: 5000, suggestedStopLoss: 100, portfolioImpact: "x", warnings: [], riskScore: 92 },
    })
    expect(alerts.some((a) => a.level === "CRITICAL" && a.category === "risk")).toBe(true)
  })

  it("WARNING on verifier canProceed=false", () => {
    const alerts = generateAlerts({
      dataQuality: dq(),
      verifierReport: { unsupportedClaims: ["x"], temporalMismatches: [], metricMismatches: [], duplicatedEvidenceIds: [], evidenceCoverageScore: 35, counterEvidenceCoverage: 15, canProceedToFinal: false, summary: "x" },
    })
    expect(alerts.some((a) => a.category === "data_quality" && a.message.includes("否決"))).toBe(true)
  })

  it("WARNING on news < 3", () => {
    const alerts = generateAlerts({ dataQuality: dq({ newsCount: 1 }) })
    expect(alerts.some((a) => a.message.includes("新聞不足"))).toBe(true)
  })

  it("CRITICAL on single stock concentration", () => {
    const r: ConcentrationReport = {
      singleStockRisk: { maxAllocation: 0.4, maxTicker: "AAPL", isConcentrated: true, warning: "AAPL 40%" },
      top3Concentration: 0.7, sectorExposure: { Tech: 0.6 }, sectorWarnings: [],
      correlationClusterRisk: "HIGH", overallConcentrationScore: 30,
    }
    const alerts = generateAlerts({ dataQuality: dq(), concentration: r })
    expect(alerts.some((a) => a.level === "CRITICAL" && a.category === "concentration")).toBe(true)
  })

  it("WARNING on low fill pct", () => {
    const er: ExecutionSimResult = {
      orderId: "x", side: "LONG", targetPrice: 100, avgFillPrice: 101,
      fillPct: 70, slippageBps: 30, estimatedCommission: 5, totalExecutionCost: 15,
      fillTimeline: "Day 1: 70%",
    }
    expect(generateAlerts({ dataQuality: dq(), executionResult: er }).some((a) => a.category === "execution")).toBe(true)
  })

  it("INFO on rejected approval", () => {
    const ad: ApprovalDecision = {
      action: "REJECTED", approvedBy: "policy", originalSize: 10,
      rejectionReasons: ["enforce: data_quality_too_low"], overrideReasons: [], approvedAt: "now",
    }
    expect(generateAlerts({ dataQuality: dq(), approvalDecision: ad }).some((a) => a.category === "thesis")).toBe(true)
  })
})
