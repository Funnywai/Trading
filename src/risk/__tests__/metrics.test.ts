import { describe, it, expect } from "vitest"
import {
  computeVolatility,
  computeSharpeRatio,
  computeSortinoRatio,
  computeMaxDrawdown,
  computeVaR,
  computeCVaR,
  computeBeta,
  computeAlpha,
  computeTrackingError,
  computeInformationRatio,
  computeAllRiskMetrics,
} from "@/risk/metrics"

const positiveReturns = [0.01, 0.02, 0.015, 0.005, 0.01]
const mixedReturns = [0.02, -0.01, 0.03, -0.02, 0.01, -0.005, 0.015, 0.01, -0.03, 0.02]
const negativeReturns = [-0.01, -0.02, -0.015, -0.005, -0.01]

describe("computeVolatility", () => {
  it("returns 0 for empty array", () => {
    expect(computeVolatility([])).toBe(0)
  })

  it("returns 0 for single element", () => {
    expect(computeVolatility([0.01])).toBe(0)
  })

  it("computes annualized volatility from daily returns", () => {
    const vol = computeVolatility(positiveReturns)
    expect(vol).toBeGreaterThan(0)
    expect(vol).toBeLessThan(1)
  })

  it("higher dispersion yields higher volatility", () => {
    const lowVol = [0.001, 0.002, 0.001, -0.001, 0.0]
    const highVol = [0.05, -0.04, 0.06, -0.03, 0.02]
    expect(computeVolatility(highVol)).toBeGreaterThan(computeVolatility(lowVol))
  })
})

describe("computeSharpeRatio", () => {
  it("returns 0 for empty array", () => {
    expect(computeSharpeRatio([])).toBe(0)
  })

  it("positive returns yield positive sharpe", () => {
    expect(computeSharpeRatio(positiveReturns)).toBeGreaterThan(0)
  })

  it("negative returns yield negative sharpe", () => {
    expect(computeSharpeRatio(negativeReturns)).toBeLessThan(0)
  })
})

describe("computeSortinoRatio", () => {
  it("returns 0 for empty array", () => {
    expect(computeSortinoRatio([])).toBe(0)
  })

  it("returns 0 when no downside deviation", () => {
    expect(computeSortinoRatio(positiveReturns)).toBe(0)
  })

  it("all-negative returns yield negative sortino", () => {
    expect(computeSortinoRatio(negativeReturns)).toBeLessThan(0)
  })
})

describe("computeMaxDrawdown", () => {
  it("returns 0 for empty array", () => {
    expect(computeMaxDrawdown([])).toBe(0)
  })

  it("returns 0 for strictly increasing prices", () => {
    expect(computeMaxDrawdown([100, 101, 102, 103, 104])).toBe(0)
  })

  it("computes correct drawdown for known peak-to-trough", () => {
    const prices = [100, 110, 95, 105, 90, 100]
    const dd = computeMaxDrawdown(prices)
    expect(dd).toBeCloseTo(20 / 110, 4)
  })

  it("captures worst drawdown even after partial recovery", () => {
    const prices = [100, 80, 90, 70, 85, 95]
    const dd = computeMaxDrawdown(prices)
    expect(dd).toBeCloseTo(30 / 100, 4)
  })
})

describe("computeVaR", () => {
  it("returns 0 for empty array", () => {
    expect(computeVaR([], 0.95)).toBe(0)
  })

  it("computes 95% VaR", () => {
    const result = computeVaR(mixedReturns, 0.95)
    expect(result).toBeLessThan(0)
  })

  it("99% VaR is more extreme than 95%", () => {
    const var95 = computeVaR(mixedReturns, 0.95)
    const var99 = computeVaR(mixedReturns, 0.99)
    expect(var99).toBeLessThanOrEqual(var95)
  })
})

describe("computeCVaR", () => {
  it("returns 0 for empty array", () => {
    expect(computeCVaR([], 0.95)).toBe(0)
  })

  it("CVaR is more extreme than VaR", () => {
    const var95 = computeVaR(mixedReturns, 0.95)
    const cvar95 = computeCVaR(mixedReturns, 0.95)
    expect(cvar95).toBeLessThanOrEqual(var95)
  })
})

describe("computeBeta", () => {
  it("returns 0 for empty arrays", () => {
    expect(computeBeta([], [])).toBe(0)
  })

  it("identical series yields beta 1", () => {
    expect(computeBeta(positiveReturns, positiveReturns)).toBeCloseTo(1, 2)
  })

  it("returns 0 when market variance is zero", () => {
    expect(computeBeta([0.01, 0.02], [0.01, 0.01])).toBe(0)
  })
})

describe("computeAlpha", () => {
  it("returns 0 for empty arrays", () => {
    expect(computeAlpha([], [])).toBe(0)
  })

  it("outperforming stock yields positive alpha", () => {
    const market = [0.01, 0.01, 0.01, 0.01, 0.01]
    const stock = [0.02, 0.02, 0.02, 0.02, 0.02]
    expect(computeAlpha(stock, market)).toBeGreaterThan(0)
  })
})

describe("computeTrackingError", () => {
  it("returns 0 for empty arrays", () => {
    expect(computeTrackingError([], [])).toBe(0)
  })

  it("identical series yield zero tracking error", () => {
    expect(computeTrackingError(positiveReturns, positiveReturns)).toBeCloseTo(0, 5)
  })
})

describe("computeInformationRatio", () => {
  it("returns 0 for empty arrays", () => {
    expect(computeInformationRatio([], [])).toBe(0)
  })
})

describe("computeAllRiskMetrics", () => {
  it("returns all metrics as an object", () => {
    const prices = [100, 101, 102, 103, 104, 103, 105, 107, 106, 108]
    const metrics = computeAllRiskMetrics(prices)
    expect(metrics).toHaveProperty("var95")
    expect(metrics).toHaveProperty("var99")
    expect(metrics).toHaveProperty("cvar95")
    expect(metrics).toHaveProperty("sharpeRatio")
    expect(metrics).toHaveProperty("sortinoRatio")
    expect(metrics).toHaveProperty("maxDrawdown")
    expect(metrics).toHaveProperty("volatility")
    expect(metrics).toHaveProperty("beta")
    expect(metrics).toHaveProperty("alpha")
    expect(metrics).toHaveProperty("trackingError")
    expect(metrics).toHaveProperty("informationRatio")
  })

  it("VaR and CVaR are positive (loss values)", () => {
    const prices = [100, 101, 102, 103, 104, 103, 105, 107, 106, 108]
    const metrics = computeAllRiskMetrics(prices)
    expect(metrics.var95).toBeGreaterThanOrEqual(0)
    expect(metrics.cvar95).toBeGreaterThanOrEqual(0)
  })

  it("returns zero beta/alpha without benchmark", () => {
    const prices = [100, 101, 102, 103, 104]
    const metrics = computeAllRiskMetrics(prices)
    expect(metrics.beta).toBe(0)
    expect(metrics.alpha).toBe(0)
  })
})
