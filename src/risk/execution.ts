import { PriceBar } from "@/types"

export interface ExecutionSimResult {
  orderId: string
  side: "LONG" | "SHORT" | "NONE"
  targetPrice: number
  avgFillPrice: number
  fillPct: number
  slippageBps: number
  estimatedCommission: number
  totalExecutionCost: number
  fillTimeline: string
  liquidityWarning?: string
}

function estimateSlippage(volatility: number, fillPct: number): number {
  if (volatility <= 0) return 0
  return volatility * 0.1 * fillPct
}

function estimateCommission(shares: number, price: number): number {
  return Math.max(1, shares * price * 0.001)
}

export function simulateExecution(params: {
  proposal: {
    side: "LONG" | "SHORT" | "NONE"
    entryBand?: { lower: number; upper: number }
    maxPositionSizePct?: number
  }
  currentPrice: number
  priceBars: PriceBar[]
  portfolioTotalValue: number
  estimatedADV?: number
}): ExecutionSimResult {
  const { proposal, currentPrice, priceBars, portfolioTotalValue, estimatedADV } = params

  const orderId = `ORD-${Date.now().toString(36)}`
  const targetPrice = proposal.entryBand
    ? (proposal.entryBand.lower + proposal.entryBand.upper) / 2
    : currentPrice

  if (priceBars.length < 5) {
    return {
      orderId, side: proposal.side, targetPrice,
      avgFillPrice: currentPrice, fillPct: 100, slippageBps: 0,
      estimatedCommission: 0, totalExecutionCost: 0,
      fillTimeline: "Insufficient data",
      liquidityWarning: "Price history too short for execution sim",
    }
  }

  const closes = priceBars.map((b) => b.close)
  const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i])
  const meanRet = returns.reduce((s, r) => s + r, 0) / returns.length
  const volatility = Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - meanRet, 2), 0) / (returns.length - 1))

  const positionSizePct = (proposal.maxPositionSizePct ?? 5) / 100
  const orderValue = portfolioTotalValue * positionSizePct
  const shares = orderValue / currentPrice

  let fillTimeline: string
  let fillPct: number
  let liquidityWarning: string | undefined

  const adv = estimatedADV ?? shares * 10
  const orderPctOfADV = shares / adv

  if (orderPctOfADV > 0.2) {
    fillPct = 70
    fillTimeline = "Day 1: 40%, Day 2: 30%, Day 3: remainder"
    liquidityWarning = `Order size (${(orderPctOfADV * 100).toFixed(1)}% of ADV) may cause significant slippage`
  } else if (orderPctOfADV > 0.1) {
    fillPct = 90
    fillTimeline = "Day 1: 70%, Day 2: 20%"
  } else if (orderPctOfADV > 0.05) {
    fillPct = 98
    fillTimeline = "Day 1: 98%"
  } else {
    fillPct = 100
    fillTimeline = "Immediate fill"
  }

  const slippageBps = Math.round(estimateSlippage(volatility, fillPct) * 10000)
  const avgFillPrice = currentPrice * (1 + slippageBps / 10000)
  const filledShares = shares * (fillPct / 100)
  const estimatedCommission = estimateCommission(filledShares, avgFillPrice)
  const slippageCost = (avgFillPrice - currentPrice) * filledShares
  const totalExecutionCost = Math.abs(slippageCost) + estimatedCommission

  return {
    orderId, side: proposal.side, targetPrice,
    avgFillPrice: Math.round(avgFillPrice * 100) / 100,
    fillPct, slippageBps,
    estimatedCommission: Math.round(estimatedCommission * 100) / 100,
    totalExecutionCost: Math.round(totalExecutionCost * 100) / 100,
    fillTimeline, liquidityWarning,
  }
}
