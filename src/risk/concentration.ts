export interface HoldingInput {
  ticker: string
  allocation: number
  sector?: string
}

export interface ConcentrationReport {
  singleStockRisk: {
    maxAllocation: number
    maxTicker: string
    isConcentrated: boolean
    warning: string | null
  }
  top3Concentration: number
  sectorExposure: Record<string, number>
  sectorWarnings: string[]
  correlationClusterRisk: "LOW" | "MEDIUM" | "HIGH"
  overallConcentrationScore: number
}

const SECTOR_MAP: Record<string, string> = {
  AAPL: "Technology", MSFT: "Technology", GOOGL: "Technology", AMZN: "Consumer Cyclical",
  META: "Technology", NVDA: "Technology", TSLA: "Consumer Cyclical", BRK_B: "Financial",
  JPM: "Financial", V: "Financial", JNJ: "Healthcare", UNH: "Healthcare",
  PG: "Consumer Defensive", KO: "Consumer Defensive", XOM: "Energy", CVX: "Energy",
  BA: "Industrials", CAT: "Industrials",
}

function getSector(ticker: string): string {
  return SECTOR_MAP[ticker.toUpperCase()] ?? "Other"
}

export function computeConcentrationRisk(holdings: HoldingInput[]): ConcentrationReport {
  if (holdings.length === 0) {
    return {
      singleStockRisk: { maxAllocation: 0, maxTicker: "", isConcentrated: false, warning: null },
      top3Concentration: 0, sectorExposure: {}, sectorWarnings: [],
      correlationClusterRisk: "LOW", overallConcentrationScore: 100,
    }
  }

  const sorted = [...holdings].sort((a, b) => b.allocation - a.allocation)
  const max = sorted[0]
  const isConcentrated = max.allocation > 0.3

  let singleStockWarning: string | null = null
  if (max.allocation > 0.5) singleStockWarning = `${max.ticker} 佔組合 ${(max.allocation * 100).toFixed(0)}%，嚴重集中風險`
  else if (max.allocation > 0.3) singleStockWarning = `${max.ticker} 佔組合 ${(max.allocation * 100).toFixed(0)}%，偏高集中風險`
  else if (max.allocation > 0.2) singleStockWarning = `${max.ticker} 佔組合 ${(max.allocation * 100).toFixed(0)}%，中度集中風險`

  const top3Concentration = sorted.slice(0, 3).reduce((s, h) => s + h.allocation, 0)

  const sectorExposure: Record<string, number> = {}
  holdings.forEach((h) => {
    const sector = h.sector ?? getSector(h.ticker)
    sectorExposure[sector] = (sectorExposure[sector] ?? 0) + h.allocation
  })

  const sectorWarnings: string[] = []
  Object.entries(sectorExposure).forEach(([sector, alloc]) => {
    if (alloc > 0.5) sectorWarnings.push(`${sector} 行業佔比 ${(alloc * 100).toFixed(0)}%，極度集中`)
    else if (alloc > 0.3) sectorWarnings.push(`${sector} 行業佔比 ${(alloc * 100).toFixed(0)}%，高度集中`)
  })

  let clusterRisk: "LOW" | "MEDIUM" | "HIGH" = "LOW"
  if (Object.values(sectorExposure).some((a) => a > 0.5)) clusterRisk = "HIGH"
  else if (top3Concentration > 0.7) clusterRisk = "HIGH"
  else if (Object.values(sectorExposure).some((a) => a > 0.3)) clusterRisk = "MEDIUM"

  let score = 100
  if (max.allocation > 0.5) score -= 30
  else if (max.allocation > 0.3) score -= 15
  else if (max.allocation > 0.2) score -= 5
  if (top3Concentration > 0.8) score -= 20
  else if (top3Concentration > 0.6) score -= 10
  if (sectorWarnings.length >= 2) score -= 20
  else if (sectorWarnings.length === 1) score -= 10
  if (score < 0) score = 0

  return {
    singleStockRisk: { maxAllocation: max.allocation, maxTicker: max.ticker, isConcentrated, warning: singleStockWarning },
    top3Concentration, sectorExposure, sectorWarnings,
    correlationClusterRisk: clusterRisk, overallConcentrationScore: score,
  }
}
