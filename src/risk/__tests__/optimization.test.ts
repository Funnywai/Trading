import { describe, it, expect } from "vitest"
import {
  computePortfolioReturn,
  computePortfolioVolatility,
  computeCovarianceMatrix,
  computeCorrelationMatrix,
  equalWeight,
  minimumVarianceWeights,
  maximumSharpeWeights,
  computeEfficientFrontier,
  optimizePortfolio,
} from "@/risk/optimization"

describe("computePortfolioReturn", () => {
  it("computes weighted sum correctly", () => {
    expect(computePortfolioReturn([0.5, 0.5], [0.1, 0.2])).toBeCloseTo(0.15, 5)
  })

  it("returns 0 for empty arrays", () => {
    expect(computePortfolioReturn([], [])).toBe(0)
  })
})

describe("computePortfolioVolatility", () => {
  it("returns sqrt(w' * cov * w)", () => {
    const cov = [
      [0.04, 0.01],
      [0.01, 0.09],
    ]
    const vol = computePortfolioVolatility([0.5, 0.5], cov)
    expect(vol).toBeGreaterThan(0)
  })

  it("returns 0 for empty arrays", () => {
    expect(computePortfolioVolatility([], [])).toBe(0)
  })
})

describe("computeCovarianceMatrix", () => {
  it("produces square matrix", () => {
    const returns = [
      [0.01, 0.02, 0.015],
      [0.005, 0.01, 0.02],
    ]
    const cov = computeCovarianceMatrix(returns)
    expect(cov).toHaveLength(2)
    expect(cov[0]).toHaveLength(2)
  })

  it("diagonal elements are variances", () => {
    const returns = [[0.01, 0.02, 0.015, 0.005, 0.01]]
    const cov = computeCovarianceMatrix(returns)
    expect(cov[0][0]).toBeGreaterThan(0)
  })

  it("matrix is symmetric", () => {
    const returns = [
      [0.01, 0.02, 0.015],
      [0.005, 0.01, 0.02],
      [0.02, 0.01, 0.005],
    ]
    const cov = computeCovarianceMatrix(returns)
    for (let i = 0; i < cov.length; i++) {
      for (let j = 0; j < cov.length; j++) {
        expect(cov[i][j]).toBeCloseTo(cov[j][i], 10)
      }
    }
  })
})

describe("computeCorrelationMatrix", () => {
  it("diagonal elements are 1", () => {
    const cov = [
      [0.04, 0.02],
      [0.02, 0.09],
    ]
    const corr = computeCorrelationMatrix(cov)
    expect(corr[0][0]).toBeCloseTo(1, 5)
    expect(corr[1][1]).toBeCloseTo(1, 5)
  })

  it("correlation is between -1 and 1", () => {
    const cov = [
      [0.04, -0.03],
      [-0.03, 0.09],
    ]
    const corr = computeCorrelationMatrix(cov)
    expect(corr[0][1]).toBeGreaterThanOrEqual(-1)
    expect(corr[0][1]).toBeLessThanOrEqual(1)
  })
})

describe("equalWeight", () => {
  it("returns 1/n for each asset", () => {
    const weights = equalWeight(4)
    expect(weights).toHaveLength(4)
    weights.forEach((w) => expect(w).toBeCloseTo(0.25, 5))
  })

  it("returns empty for 0 assets", () => {
    expect(equalWeight(0)).toEqual([])
  })
})

describe("minimumVarianceWeights", () => {
  it("weights sum to approximately 1", () => {
    const cov = [
      [0.04, 0.01, 0.005],
      [0.01, 0.09, 0.02],
      [0.005, 0.02, 0.16],
    ]
    const weights = minimumVarianceWeights(cov)
    const total = weights.reduce((s, w) => s + w, 0)
    expect(total).toBeCloseTo(1, 5)
  })

  it("weight is 1 for single asset", () => {
    const cov = [[0.04]]
    const weights = minimumVarianceWeights(cov)
    expect(weights[0]).toBeCloseTo(1, 5)
  })
})

describe("maximumSharpeWeights", () => {
  it("weights sum to approximately 1", () => {
    const returns = [
      [0.01, 0.02, 0.015, 0.01, 0.02],
      [0.005, 0.01, 0.02, 0.01, 0.015],
    ]
    const cov = computeCovarianceMatrix(returns)
    const weights = maximumSharpeWeights(returns, cov)
    const total = weights.reduce((s, w) => s + w, 0)
    expect(total).toBeCloseTo(1, 5)
  })
})

describe("computeEfficientFrontier", () => {
  it("returns array of volatility/return pairs", () => {
    const returns = [
      [0.01, 0.02, 0.015, 0.01, 0.02],
      [0.005, 0.01, 0.02, 0.01, 0.015],
    ]
    const cov = computeCovarianceMatrix(returns)
    const frontier = computeEfficientFrontier(returns, cov, 0.045, 10)
    expect(frontier.length).toBeGreaterThan(0)
    frontier.forEach((point) => {
      expect(point).toHaveProperty("volatility")
      expect(point).toHaveProperty("return")
      expect(point.volatility).toBeGreaterThanOrEqual(0)
    })
  })
})

describe("optimizePortfolio", () => {
  it("returns complete OptimizationResult", () => {
    const returns = [
      [0.01, 0.02, 0.015, 0.01, 0.02, 0.01, 0.015, 0.02, 0.01, 0.015],
      [0.005, 0.01, 0.02, 0.01, 0.015, 0.01, 0.02, 0.015, 0.01, 0.01],
    ]
    const result = optimizePortfolio(returns)
    expect(result).toHaveProperty("weights")
    expect(result).toHaveProperty("expectedReturn")
    expect(result).toHaveProperty("volatility")
    expect(result).toHaveProperty("sharpeRatio")
    expect(result).toHaveProperty("efficientFrontier")
    const weightSum = Object.values(result.weights).reduce((s, w) => s + w, 0)
    expect(weightSum).toBeCloseTo(1, 5)
  })
})
