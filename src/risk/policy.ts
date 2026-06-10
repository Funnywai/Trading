import { RiskMetrics } from "@/types"
import { ConcentrationReport } from "./concentration"

export interface PolicyResult {
  maxPositionSizePct: number
  maxPositionSizeDollar: number
  cashReserveFloor: number
  stopLossDistancePct: number
  canAddPosition: boolean
  blockingReasons: string[]
  suggestedAction: "ALLOW" | "CAUTION" | "BLOCK"
}

export function applyPortfolioPolicy(
  portfolioTotalValue: number,
  cashRatio: number,
  metrics: RiskMetrics,
  concentration: ConcentrationReport,
  thesisConfidence: number,
): PolicyResult {
  const cashAvailable = portfolioTotalValue * cashRatio
  const blockingReasons: string[] = []

  let maxPct = 0.5
  if (metrics.volatility > 0.4) {
    blockingReasons.push(`波動率 ${(metrics.volatility * 100).toFixed(0)}% 過高`)
    maxPct = Math.min(maxPct, 0.05)
  } else if (metrics.volatility > 0.25) {
    maxPct = Math.min(maxPct, 0.1)
  } else {
    maxPct = Math.min(maxPct, 0.15)
  }

  if (metrics.sharpeRatio < 0) {
    blockingReasons.push("Sharpe Ratio 為負，風險回報不利")
    maxPct = Math.min(maxPct, 0.03)
  }

  if (metrics.maxDrawdown > 0.3) {
    blockingReasons.push(`最大回撤 ${(metrics.maxDrawdown * 100).toFixed(0)}% 過深`)
    maxPct = Math.min(maxPct, 0.05)
  }

  if (concentration.singleStockRisk.isConcentrated) {
    blockingReasons.push(`現有持倉集中：${concentration.singleStockRisk.warning}`)
    maxPct = Math.min(maxPct, 0.05)
  }

  if (concentration.overallConcentrationScore < 50) {
    blockingReasons.push(`整體集中度風險分數僅 ${concentration.overallConcentrationScore}/100`)
    maxPct = Math.min(maxPct, 0.03)
  }

  if (concentration.correlationClusterRisk === "HIGH") {
    blockingReasons.push("行業集中度過高，新增持倉可能加劇集中風險")
  }

  if (concentration.top3Concentration > 0.7) {
    blockingReasons.push(`前三大持倉佔比 ${(concentration.top3Concentration * 100).toFixed(0)}%，集中度過高`)
  }

  if (thesisConfidence < 0.5) {
    blockingReasons.push("Thesis 信心不足")
    maxPct = Math.min(maxPct, 0.03)
  }

  const stopLossPct = Math.min(0.15, metrics.volatility * 1.5)

  if (cashAvailable < portfolioTotalValue * 0.05) {
    blockingReasons.push("可用現金不足 5%")
  }

  let suggestedAction: "ALLOW" | "CAUTION" | "BLOCK"
  if (blockingReasons.length >= 3 || metrics.volatility > 0.5 || concentration.overallConcentrationScore < 30) {
    suggestedAction = "BLOCK"
  } else if (blockingReasons.length > 0) {
    suggestedAction = "CAUTION"
  } else {
    suggestedAction = "ALLOW"
  }

  return {
    maxPositionSizePct: maxPct,
    maxPositionSizeDollar: Math.min(portfolioTotalValue * maxPct, cashAvailable),
    cashReserveFloor: portfolioTotalValue * 0.05,
    stopLossDistancePct: stopLossPct,
    canAddPosition: suggestedAction !== "BLOCK",
    blockingReasons,
    suggestedAction,
  }
}
