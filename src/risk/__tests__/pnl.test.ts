import { describe, it, expect } from "vitest"
import { computePnLSummary } from "@/risk/pnl"

describe("computePnLSummary", () => {
  it("returns zeroes for empty array", () => {
    const result = computePnLSummary([])
    expect(result.totalRuns).toBe(0)
  })

  it("counts approved and rejected correctly", () => {
    const runs = [
      { approvalDecision: JSON.stringify({ action: "APPROVED" }), durationMs: 5000 },
      { approvalDecision: JSON.stringify({ action: "REJECTED" }), durationMs: 3000 },
      { approvalDecision: JSON.stringify({ action: "RESIZED" }), durationMs: 4000 },
    ]
    const result = computePnLSummary(runs)
    expect(result.approvedCount).toBe(2)
    expect(result.rejectedCount).toBe(1)
    expect(result.avgDurationMs).toBe(4000)
  })

  it("counts action distribution", () => {
    const runs = [
      { tradeProposal: JSON.stringify({ action: "ADD_SMALL" }), durationMs: 1000 },
      { tradeProposal: JSON.stringify({ action: "OBSERVE" }), durationMs: 1000 },
      { tradeProposal: JSON.stringify({ action: "ADD_SMALL" }), durationMs: 1000 },
    ]
    const result = computePnLSummary(runs)
    expect(result.actionDistribution["ADD_SMALL"]).toBe(2)
    expect(result.actionDistribution["OBSERVE"]).toBe(1)
  })

  it("handles null fields gracefully", () => {
    const runs = [
      { approvalDecision: null, tradeProposal: null, durationMs: 1000 },
    ]
    const result = computePnLSummary(runs)
    expect(result.totalRuns).toBe(1)
    expect(result.approvedCount).toBe(0)
  })
})
