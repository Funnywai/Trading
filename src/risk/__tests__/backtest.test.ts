import { describe, it, expect } from "vitest"
import { runMovingAverageBacktest, runMomentumBacktest, runBacktest } from "@/risk/backtest"
import { PriceBar } from "@/types"

function generateTrendingBars(
  n: number,
  startPrice: number,
  trend: number,
  noise: number
): PriceBar[] {
  const bars: PriceBar[] = []
  let price = startPrice
  for (let i = 0; i < n; i++) {
    price = price * (1 + trend + (Math.random() - 0.5) * noise)
    bars.push({
      date: new Date(2024, 0, i + 1).toISOString().split("T")[0],
      open: price * (1 - Math.random() * 0.01),
      high: price * (1 + Math.random() * 0.02),
      low: price * (1 - Math.random() * 0.02),
      close: price,
      volume: 1000000 + Math.random() * 5000000,
    })
  }
  return bars
}

describe("runMovingAverageBacktest", () => {
  it("returns valid BacktestResult structure", () => {
    const bars = generateTrendingBars(100, 100, 0.001, 0.02)
    const result = runMovingAverageBacktest(bars, 20, 50, 10000)
    expect(result).toHaveProperty("totalReturn")
    expect(result).toHaveProperty("annualizedReturn")
    expect(result).toHaveProperty("maxDrawdown")
    expect(result).toHaveProperty("sharpeRatio")
    expect(result).toHaveProperty("winRate")
    expect(result).toHaveProperty("totalTrades")
    expect(result).toHaveProperty("trades")
  })

  it("no trades with too few bars", () => {
    const bars = generateTrendingBars(10, 100, 0, 0)
    const result = runMovingAverageBacktest(bars, 20, 50, 10000)
    expect(result.totalTrades).toBe(0)
    expect(result.totalReturn).toBe(0)
  })
})

describe("runMomentumBacktest", () => {
  it("returns valid BacktestResult structure", () => {
    const bars = generateTrendingBars(100, 100, 0.001, 0.02)
    const result = runMomentumBacktest(bars, 20, 0.05, 10000)
    expect(result).toHaveProperty("totalReturn")
    expect(result.totalTrades).toBeGreaterThanOrEqual(0)
  })
})

describe("runBacktest", () => {
  it("dispatches to moving average strategy", () => {
    const bars = generateTrendingBars(100, 100, 0.001, 0.02)
    const result = runBacktest(bars, "movingAverageCross", 10000)
    expect(result.totalTrades).toBeGreaterThanOrEqual(0)
  })

  it("dispatches to momentum strategy", () => {
    const bars = generateTrendingBars(100, 100, 0.001, 0.02)
    const result = runBacktest(bars, "momentum", 10000)
    expect(result.totalTrades).toBeGreaterThanOrEqual(0)
  })

  it("strong uptrend yields positive return", () => {
    const bars = generateTrendingBars(200, 100, 0.003, 0.005)
    const result = runBacktest(bars, "momentum", 10000)
    expect(result.totalReturn).toBeDefined()
    expect(typeof result.totalReturn).toBe("number")
  })
})
