import { calculateReturns, mean, stdDev, percentile } from "@/lib/utils"
import { RISK_FREE_RATE, TRADING_DAYS_PER_YEAR } from "@/lib/constants"
import { RiskMetrics } from "@/types"

export function computeVolatility(returns: number[]): number {
  return stdDev(returns) * Math.sqrt(TRADING_DAYS_PER_YEAR)
}

export function computeSharpeRatio(returns: number[]): number {
  if (returns.length < 2) return 0
  const dailyRf = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR
  const retMean = mean(returns)
  const retStd = stdDev(returns)
  if (retStd === 0) return 0
  return ((retMean - dailyRf) / retStd) * Math.sqrt(TRADING_DAYS_PER_YEAR)
}

export function computeSortinoRatio(returns: number[]): number {
  if (returns.length < 2) return 0
  const downside = returns.filter((r) => r < 0)
  if (downside.length < 2) return 0
  const downsideDev = stdDev(downside)
  if (downsideDev === 0) return 0
  const dailyRf = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR
  return ((mean(returns) - dailyRf) / downsideDev) * Math.sqrt(TRADING_DAYS_PER_YEAR)
}

export function computeMaxDrawdown(prices: number[]): number {
  if (prices.length < 2) return 0
  let peak = prices[0]
  let maxDD = 0
  for (const p of prices) {
    if (p > peak) peak = p
    const dd = (peak - p) / peak
    if (dd > maxDD) maxDD = dd
  }
  return maxDD
}

export function computeVaR(returns: number[], confidence: number): number {
  if (returns.length === 0) return 0
  const p = confidence > 1 ? 100 - confidence : (1 - confidence) * 100
  return percentile(returns, p)
}

export function computeCVaR(returns: number[], confidence: number): number {
  if (returns.length === 0) return 0
  const p = confidence > 1 ? 100 - confidence : (1 - confidence) * 100
  const varVal = percentile(returns, p)
  const below = returns.filter((r) => r <= varVal)
  if (below.length === 0) return 0
  return mean(below)
}

export function computeBeta(stockReturns: number[], marketReturns: number[]): number {
  if (stockReturns.length < 2 || marketReturns.length < 2) return 0
  const n = Math.min(stockReturns.length, marketReturns.length)
  const sR = stockReturns.slice(0, n)
  const mR = marketReturns.slice(0, n)
  const sMean = mean(sR)
  const mMean = mean(mR)
  let cov = 0
  let marketVar = 0
  for (let i = 0; i < n; i++) {
    cov += (sR[i] - sMean) * (mR[i] - mMean)
    marketVar += (mR[i] - mMean) ** 2
  }
  cov /= n - 1
  marketVar /= n - 1
  if (marketVar === 0) return 0
  return cov / marketVar
}

export function computeAlpha(
  stockReturns: number[],
  marketReturns: number[],
  beta?: number
): number {
  if (stockReturns.length === 0 || marketReturns.length === 0) return 0
  const n = Math.min(stockReturns.length, marketReturns.length)
  const dailyRf = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR
  const sR = stockReturns.slice(0, n)
  const mR = marketReturns.slice(0, n)
  const b = beta ?? computeBeta(sR, mR)
  const stockMean = mean(sR)
  const marketMean = mean(mR)
  return (stockMean - dailyRf - b * (marketMean - dailyRf)) * TRADING_DAYS_PER_YEAR
}

export function computeTrackingError(stockReturns: number[], marketReturns: number[]): number {
  if (stockReturns.length === 0 || marketReturns.length === 0) return 0
  const n = Math.min(stockReturns.length, marketReturns.length)
  const diffs: number[] = []
  for (let i = 0; i < n; i++) {
    diffs.push(stockReturns[i] - marketReturns[i])
  }
  return stdDev(diffs) * Math.sqrt(TRADING_DAYS_PER_YEAR)
}

export function computeInformationRatio(stockReturns: number[], marketReturns: number[]): number {
  if (stockReturns.length === 0 || marketReturns.length === 0) return 0
  const n = Math.min(stockReturns.length, marketReturns.length)
  const diffs: number[] = []
  for (let i = 0; i < n; i++) {
    diffs.push(stockReturns[i] - marketReturns[i])
  }
  const activeReturnDaily = mean(diffs)
  const activeReturnAnnual = activeReturnDaily * TRADING_DAYS_PER_YEAR
  const trackingErrorAnnual = stdDev(diffs) * Math.sqrt(TRADING_DAYS_PER_YEAR)
  if (trackingErrorAnnual === 0) return 0
  return activeReturnAnnual / trackingErrorAnnual
}

export function computeAllRiskMetrics(prices: number[], benchmarkPrices?: number[]): RiskMetrics {
  const returns = calculateReturns(prices)

  if (returns.length === 0) {
    return {
      var95: 0,
      var99: 0,
      cvar95: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      volatility: 0,
      beta: 0,
      alpha: 0,
      trackingError: 0,
      informationRatio: 0,
    }
  }

  const var95 = -computeVaR(returns, 95)
  const var99 = -computeVaR(returns, 99)
  const cvar95 = -computeCVaR(returns, 95)

  const sharpeRatio = computeSharpeRatio(returns)
  const sortinoRatio = computeSortinoRatio(returns)
  const maxDrawdown = computeMaxDrawdown(prices)
  const volatility = computeVolatility(returns)

  let beta = 0
  let alpha = 0
  let trackingError = 0
  let informationRatio = 0

  if (benchmarkPrices && benchmarkPrices.length > 1) {
    const marketReturns = calculateReturns(benchmarkPrices)
    if (marketReturns.length > 0) {
      beta = computeBeta(returns, marketReturns)
      alpha = computeAlpha(returns, marketReturns, beta)
      trackingError = computeTrackingError(returns, marketReturns)
      informationRatio = computeInformationRatio(returns, marketReturns)
    }
  }

  return {
    var95,
    var99,
    cvar95,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    volatility,
    beta,
    alpha,
    trackingError,
    informationRatio,
  }
}
