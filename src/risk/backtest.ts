import { calculateReturns, mean, stdDev, extractCloses } from "@/lib/utils"
import { RISK_FREE_RATE, TRADING_DAYS_PER_YEAR } from "@/lib/constants"
import { PriceBar, BacktestTrade, BacktestResult } from "@/types"

function computeEquityMaxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length < 2) return 0
  let peak = equityCurve[0]
  let maxDD = 0
  for (const eq of equityCurve) {
    if (eq > peak) peak = eq
    const dd = (peak - eq) / peak
    if (dd > maxDD) maxDD = dd
  }
  return maxDD
}

function computeEquitySharpe(equityCurve: number[]): number {
  if (equityCurve.length < 2) return 0
  const eqReturns = calculateReturns(equityCurve)
  if (eqReturns.length < 2) return 0
  const dailyRf = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR
  const retMean = mean(eqReturns)
  const retStd = stdDev(eqReturns)
  if (retStd === 0) return 0
  return ((retMean - dailyRf) / retStd) * Math.sqrt(TRADING_DAYS_PER_YEAR)
}

function computeMovingAverage(prices: number[], window: number): number[] {
  const mas: number[] = []
  for (let i = 0; i < prices.length; i++) {
    if (i < window - 1) {
      mas.push(NaN)
    } else {
      let sumVal = 0
      for (let j = i - window + 1; j <= i; j++) {
        sumVal += prices[j]
      }
      mas.push(sumVal / window)
    }
  }
  return mas
}

function buildResult(
  initialCapital: number,
  finalEquity: number,
  tradingDays: number,
  equityCurve: number[],
  trades: BacktestTrade[]
): BacktestResult {
  const totalReturn = (finalEquity - initialCapital) / initialCapital
  const annualizedReturn =
    tradingDays > 0
      ? Math.pow(1 + totalReturn, TRADING_DAYS_PER_YEAR / tradingDays) - 1
      : 0
  const maxDD = computeEquityMaxDrawdown(equityCurve)
  const sharpe = computeEquitySharpe(equityCurve)

  const sellTrades = trades.filter((t) => t.action === "SELL" && t.pnl !== undefined)
  const winningTrades = sellTrades.filter((t) => (t.pnl ?? 0) > 0)
  const winRate = sellTrades.length > 0 ? winningTrades.length / sellTrades.length : 0

  return {
    totalReturn,
    annualizedReturn,
    maxDrawdown: maxDD,
    sharpeRatio: sharpe,
    winRate,
    totalTrades: sellTrades.length,
    trades,
  }
}

export function runMovingAverageBacktest(
  bars: PriceBar[],
  shortWindow: number,
  longWindow: number,
  initialCapital: number
): BacktestResult {
  const trades: BacktestTrade[] = []
  const empty = {
    totalReturn: 0,
    annualizedReturn: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    winRate: 0,
    totalTrades: 0,
    trades: [],
  }

  if (bars.length <= longWindow) return empty

  const prices = extractCloses(bars)
  const shortMA = computeMovingAverage(prices, shortWindow)
  const longMA = computeMovingAverage(prices, longWindow)

  let cash = initialCapital
  let shares = 0
  const equityCurve: number[] = []
  let entryPrice = 0

  for (let i = 0; i < bars.length; i++) {
    const price = prices[i]
    equityCurve.push(cash + shares * price)

    if (isNaN(shortMA[i]) || isNaN(longMA[i])) continue
    if (i === 0) continue
    if (isNaN(shortMA[i - 1]) || isNaN(longMA[i - 1])) continue

    const prevShort = shortMA[i - 1]
    const prevLong = longMA[i - 1]
    const currShort = shortMA[i]
    const currLong = longMA[i]

    if (prevShort <= prevLong && currShort > currLong && shares === 0) {
      shares = cash / price
      entryPrice = price
      cash = 0
      trades.push({
        date: bars[i].date,
        ticker: "STOCK",
        action: "BUY",
        price,
        shares,
      })
    } else if (prevShort >= prevLong && currShort < currLong && shares > 0) {
      const pnl = shares * (price - entryPrice)
      cash = shares * price
      trades.push({
        date: bars[i].date,
        ticker: "STOCK",
        action: "SELL",
        price,
        shares,
        pnl,
      })
      shares = 0
    }
  }

  if (shares > 0) {
    const lastPrice = prices[prices.length - 1]
    const pnl = shares * (lastPrice - entryPrice)
    cash = shares * lastPrice
    trades.push({
      date: bars[bars.length - 1].date,
      ticker: "STOCK",
      action: "SELL",
      price: lastPrice,
      shares,
      pnl,
    })
    shares = 0
    equityCurve[equityCurve.length - 1] = cash
  }

  const finalEquity = cash + shares * prices[prices.length - 1]
  return buildResult(initialCapital, finalEquity, bars.length, equityCurve, trades)
}

export function runMomentumBacktest(
  bars: PriceBar[],
  lookback: number,
  threshold: number,
  initialCapital: number
): BacktestResult {
  const trades: BacktestTrade[] = []
  const empty = {
    totalReturn: 0,
    annualizedReturn: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    winRate: 0,
    totalTrades: 0,
    trades: [],
  }

  if (bars.length <= lookback) return empty

  const prices = extractCloses(bars)
  let cash = initialCapital
  let shares = 0
  const equityCurve: number[] = []
  let entryPrice = 0

  for (let i = 0; i < bars.length; i++) {
    const price = prices[i]
    equityCurve.push(cash + shares * price)

    if (i < lookback) continue

    const pastPrice = prices[i - lookback]
    if (pastPrice === 0) continue
    const momentumReturn = (price - pastPrice) / pastPrice

    if (momentumReturn > threshold && shares === 0) {
      shares = cash / price
      entryPrice = price
      cash = 0
      trades.push({
        date: bars[i].date,
        ticker: "STOCK",
        action: "BUY",
        price,
        shares,
      })
    } else if (momentumReturn < -threshold && shares > 0) {
      const pnl = shares * (price - entryPrice)
      cash = shares * price
      trades.push({
        date: bars[i].date,
        ticker: "STOCK",
        action: "SELL",
        price,
        shares,
        pnl,
      })
      shares = 0
    }
  }

  if (shares > 0) {
    const lastPrice = prices[prices.length - 1]
    const pnl = shares * (lastPrice - entryPrice)
    cash = shares * lastPrice
    trades.push({
      date: bars[bars.length - 1].date,
      ticker: "STOCK",
      action: "SELL",
      price: lastPrice,
      shares,
      pnl,
    })
    shares = 0
    equityCurve[equityCurve.length - 1] = cash
  }

  const finalEquity = cash
  return buildResult(initialCapital, finalEquity, bars.length, equityCurve, trades)
}

export function runMeanReversionBacktest(
  bars: PriceBar[],
  lookback: number,
  threshold: number,
  initialCapital: number
): BacktestResult {
  const trades: BacktestTrade[] = []
  const empty = {
    totalReturn: 0,
    annualizedReturn: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    winRate: 0,
    totalTrades: 0,
    trades: [],
  }

  if (bars.length <= lookback) return empty

  const prices = extractCloses(bars)
  let cash = initialCapital
  let shares = 0
  const equityCurve: number[] = []
  let entryPrice = 0

  for (let i = 0; i < bars.length; i++) {
    const price = prices[i]
    equityCurve.push(cash + shares * price)

    if (i < lookback) continue

    const windowPrices = prices.slice(i - lookback, i)
    if (windowPrices.length < 2) continue
    const windowMean = mean(windowPrices)
    const windowStd = stdDev(windowPrices)

    if (windowStd === 0) continue

    const zScore = (price - windowMean) / windowStd

    if (zScore < -threshold && shares === 0) {
      shares = cash / price
      entryPrice = price
      cash = 0
      trades.push({
        date: bars[i].date,
        ticker: "STOCK",
        action: "BUY",
        price,
        shares,
      })
    } else if (zScore > threshold && shares > 0) {
      const pnl = shares * (price - entryPrice)
      cash = shares * price
      trades.push({
        date: bars[i].date,
        ticker: "STOCK",
        action: "SELL",
        price,
        shares,
        pnl,
      })
      shares = 0
    }
  }

  if (shares > 0) {
    const lastPrice = prices[prices.length - 1]
    const pnl = shares * (lastPrice - entryPrice)
    cash = shares * lastPrice
    trades.push({
      date: bars[bars.length - 1].date,
      ticker: "STOCK",
      action: "SELL",
      price: lastPrice,
      shares,
      pnl,
    })
    shares = 0
    equityCurve[equityCurve.length - 1] = cash
  }

  const finalEquity = cash
  return buildResult(initialCapital, finalEquity, bars.length, equityCurve, trades)
}

export function runBacktest(
  bars: PriceBar[],
  strategy: "momentum" | "meanReversion" | "movingAverageCross",
  initialCapital: number
): BacktestResult {
  switch (strategy) {
    case "momentum":
      return runMomentumBacktest(bars, 20, 0.05, initialCapital)
    case "meanReversion":
      return runMeanReversionBacktest(bars, 20, 1, initialCapital)
    case "movingAverageCross":
      return runMovingAverageBacktest(bars, 20, 50, initialCapital)
  }
}
