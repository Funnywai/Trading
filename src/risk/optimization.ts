import { mean, sum } from "@/lib/utils"
import { RISK_FREE_RATE, TRADING_DAYS_PER_YEAR } from "@/lib/constants"
import { OptimizationResult } from "@/types"

function dotProduct(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let result = 0
  for (let i = 0; i < n; i++) result += a[i] * b[i]
  return result
}

function matrixVectorMultiply(A: number[][], v: number[]): number[] {
  const n = A.length
  const result: number[] = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < v.length; j++) {
      result[i] += A[i][j] * v[j]
    }
  }
  return result
}

function invertMatrix(A: number[][]): number[][] {
  const n = A.length
  if (n === 0) return []

  const aug: number[][] = A.map((row, i) => {
    const identity = new Array(n).fill(0)
    identity[i] = 1
    return [...row, ...identity]
  })

  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row
      }
    }

    ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]

    const pivot = aug[col][col]
    if (Math.abs(pivot) < 1e-12) {
      return A.map((_, i) => {
        const row = new Array(n).fill(0)
        row[i] = 1
        return row
      })
    }

    for (let j = col; j < 2 * n; j++) {
      aug[col][j] /= pivot
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      for (let j = col; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j]
      }
    }
  }

  return aug.map((row) => row.slice(n))
}

export function computePortfolioReturn(weights: number[], returns: number[]): number {
  return dotProduct(weights, returns)
}

export function computePortfolioVolatility(weights: number[], covarianceMatrix: number[][]): number {
  const n = weights.length
  if (n === 0 || covarianceMatrix.length === 0) return 0
  let variance = 0
  for (let i = 0; i < n; i++) {
    let rowSum = 0
    for (let j = 0; j < n; j++) {
      rowSum += covarianceMatrix[i][j] * weights[j]
    }
    variance += weights[i] * rowSum
  }
  return Math.sqrt(Math.max(0, variance))
}

export function computeCovarianceMatrix(returnsMatrix: number[][]): number[][] {
  const nAssets = returnsMatrix.length
  if (nAssets === 0) return []
  const nObs = returnsMatrix[0].length
  if (nObs < 2) {
    return returnsMatrix.map(() => new Array(nAssets).fill(0))
  }

  const means = returnsMatrix.map((r) => mean(r))
  const cov: number[][] = Array.from({ length: nAssets }, () => new Array(nAssets).fill(0))

  for (let i = 0; i < nAssets; i++) {
    for (let j = i; j < nAssets; j++) {
      let sumCov = 0
      for (let t = 0; t < nObs; t++) {
        sumCov += (returnsMatrix[i][t] - means[i]) * (returnsMatrix[j][t] - means[j])
      }
      const val = sumCov / (nObs - 1)
      cov[i][j] = val
      cov[j][i] = val
    }
  }
  return cov
}

export function computeCorrelationMatrix(covMatrix: number[][]): number[][] {
  const n = covMatrix.length
  const corr: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const denom = Math.sqrt(covMatrix[i][i] * covMatrix[j][j])
      corr[i][j] = denom === 0 ? 0 : covMatrix[i][j] / denom
    }
  }
  return corr
}

export function equalWeight(assetCount: number): number[] {
  if (assetCount <= 0) return []
  const w = 1 / assetCount
  return new Array(assetCount).fill(w)
}

export function minimumVarianceWeights(covMatrix: number[][]): number[] {
  const n = covMatrix.length
  if (n === 0) return []
  if (n === 1) return [1]

  const invCov = invertMatrix(covMatrix)
  const ones = new Array(n).fill(1)
  const invCovOnes = matrixVectorMultiply(invCov, ones)
  const denominator = dotProduct(ones, invCovOnes)

  if (Math.abs(denominator) < 1e-12) return equalWeight(n)

  return invCovOnes.map((v) => v / denominator)
}

function targetReturnWeights(
  meanReturns: number[],
  invCov: number[][],
  targetRet: number
): number[] {
  const n = meanReturns.length
  const ones = new Array(n).fill(1)

  const invCovOnes = matrixVectorMultiply(invCov, ones)
  const invCovMu = matrixVectorMultiply(invCov, meanReturns)

  const A = dotProduct(invCovOnes, ones)
  const B = dotProduct(invCovOnes, meanReturns)
  const C = dotProduct(invCovMu, meanReturns)
  const D = A * C - B * B

  if (Math.abs(D) < 1e-12) return equalWeight(n)

  const lambda1 = (C - B * targetRet) / D
  const lambda2 = (A * targetRet - B) / D

  return invCovOnes.map((v, i) => lambda1 * v + lambda2 * invCovMu[i])
}

export function maximumSharpeWeights(
  returns: number[][],
  covMatrix: number[][],
  riskFreeRate: number = RISK_FREE_RATE
): number[] {
  const n = returns.length
  if (n === 0) return []

  const dailyRf = riskFreeRate / TRADING_DAYS_PER_YEAR
  const meanReturns = returns.map((r) => mean(r))
  const excessReturns = meanReturns.map((r) => r - dailyRf)
  const invCov = invertMatrix(covMatrix)
  const invCovExcess = matrixVectorMultiply(invCov, excessReturns)
  const denom = sum(invCovExcess)

  if (Math.abs(denom) < 1e-12) return equalWeight(n)

  return invCovExcess.map((v) => v / denom)
}

export function computeEfficientFrontier(
  returns: number[][],
  covMatrix: number[][],
  riskFreeRate: number,
  numPoints: number = 20
): Array<{ volatility: number; return: number }> {
  const n = returns.length
  if (n === 0 || covMatrix.length === 0) return []

  const meanReturns = returns.map((r) => mean(r))
  const invCov = invertMatrix(covMatrix)

  const ones = new Array(n).fill(1)
  const invCovOnes = matrixVectorMultiply(invCov, ones)
  const invCovMu = matrixVectorMultiply(invCov, meanReturns)

  const A = dotProduct(invCovOnes, ones)
  const B = dotProduct(invCovOnes, meanReturns)
  const C = dotProduct(invCovMu, meanReturns)
  const D = A * C - B * B

  if (D <= 1e-12) {
    const mvpRet = B / A
    const mvpVol = Math.sqrt(Math.max(0, 1 / A))
    return [
      {
        volatility: mvpVol * Math.sqrt(TRADING_DAYS_PER_YEAR),
        return: mvpRet * TRADING_DAYS_PER_YEAR,
      },
    ]
  }

  const mvpRet = B / A
  const maxRet = Math.max(...meanReturns)

  const points: Array<{ volatility: number; return: number }> = []

  for (let i = 0; i < numPoints; i++) {
    const t = numPoints === 1 ? 0 : i / (numPoints - 1)
    const targetRetDaily = mvpRet + t * (maxRet - mvpRet)
    const variance = (A * targetRetDaily * targetRetDaily - 2 * B * targetRetDaily + C) / D
    const volDaily = Math.sqrt(Math.max(0, variance))
    points.push({
      volatility: volDaily * Math.sqrt(TRADING_DAYS_PER_YEAR),
      return: targetRetDaily * TRADING_DAYS_PER_YEAR,
    })
  }

  return points
}

export function optimizePortfolio(
  returns: number[][],
  targetReturn?: number
): OptimizationResult {
  if (returns.length === 0 || returns[0].length === 0) {
    return {
      weights: {},
      expectedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      efficientFrontier: [],
    }
  }

  const covMatrix = computeCovarianceMatrix(returns)
  const meanReturns = returns.map((r) => mean(r))

  let weights: number[]

  if (targetReturn !== undefined) {
    const dailyTarget = targetReturn / TRADING_DAYS_PER_YEAR
    const invCov = invertMatrix(covMatrix)
    weights = targetReturnWeights(meanReturns, invCov, dailyTarget)
  } else {
    weights = maximumSharpeWeights(returns, covMatrix)
  }

  const portReturnDaily = computePortfolioReturn(weights, meanReturns)
  const portVolDaily = computePortfolioVolatility(weights, covMatrix)

  const annualReturn = portReturnDaily * TRADING_DAYS_PER_YEAR
  const annualVol = portVolDaily * Math.sqrt(TRADING_DAYS_PER_YEAR)
  const sharpeRatio = annualVol === 0 ? 0 : (annualReturn - RISK_FREE_RATE) / annualVol

  const frontier = computeEfficientFrontier(returns, covMatrix, RISK_FREE_RATE, 20)

  const weightsRecord: Record<string, number> = {}
  for (let i = 0; i < weights.length; i++) {
    weightsRecord[i.toString()] = weights[i]
  }

  return {
    weights: weightsRecord,
    expectedReturn: annualReturn,
    volatility: annualVol,
    sharpeRatio,
    efficientFrontier: frontier,
  }
}
