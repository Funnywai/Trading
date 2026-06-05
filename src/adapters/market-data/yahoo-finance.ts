import YahooFinance from "yahoo-finance2"
import { IMarketDataAdapter } from "./interface"
import { IFundamentalAdapter } from "@/adapters/fundamental/interface"
import { PriceBar, FundamentalData } from "@/types"

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
})

function toNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

function rangeToDates(range: string): { period1: Date; period2: Date } {
  const period2 = new Date()

  let period1: Date
  switch (range) {
    case "1d":
      period1 = new Date(period2)
      period1.setDate(period1.getDate() - 1)
      break
    case "5d":
      period1 = new Date(period2)
      period1.setDate(period1.getDate() - 5)
      break
    case "1mo":
      period1 = new Date(period2)
      period1.setMonth(period1.getMonth() - 1)
      break
    case "3mo":
      period1 = new Date(period2)
      period1.setMonth(period1.getMonth() - 3)
      break
    case "6mo":
      period1 = new Date(period2)
      period1.setMonth(period1.getMonth() - 6)
      break
    case "1y":
      period1 = new Date(period2)
      period1.setFullYear(period1.getFullYear() - 1)
      break
    case "2y":
      period1 = new Date(period2)
      period1.setFullYear(period1.getFullYear() - 2)
      break
    case "5y":
      period1 = new Date(period2)
      period1.setFullYear(period1.getFullYear() - 5)
      break
    case "max":
      period1 = new Date("1970-01-01")
      break
    default:
      throw new Error(`Unsupported range: "${range}". Supported values: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max`)
  }

  return { period1, period2 }
}

export class YahooFinanceAdapter implements IMarketDataAdapter, IFundamentalAdapter {
  async getQuote(ticker: string) {
    try {
      const quote = await yahooFinance.quote(ticker)
      return {
        ticker: quote.symbol ?? ticker,
        name: quote.longName ?? quote.shortName ?? ticker,
        currentPrice: quote.regularMarketPrice ?? 0,
        previousClose: quote.regularMarketPreviousClose ?? 0,
        change: quote.regularMarketChange ?? 0,
        changePercent: quote.regularMarketChangePercent ?? 0,
        volume: quote.regularMarketVolume ?? 0,
        marketCap: quote.marketCap,
      }
    } catch (err) {
      throw new Error(
        `Failed to fetch quote for "${ticker}": ${err instanceof Error ? err.message : "Unknown error"}`
      )
    }
  }

  async getHistoricalPrices(
    ticker: string,
    interval: string,
    range: string
  ): Promise<PriceBar[]> {
    try {
      const { period1, period2 } = rangeToDates(range)

      const results = await yahooFinance.historical(ticker, {
        period1,
        period2,
        interval: interval as "1d" | "1wk" | "1mo",
      })

      return results.map((row) => ({
        date: row.date.toISOString().split("T")[0],
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      }))
    } catch (err) {
      throw new Error(
        `Failed to fetch historical prices for "${ticker}": ${err instanceof Error ? err.message : "Unknown error"}`
      )
    }
  }

  async searchTickers(
    query: string
  ): Promise<Array<{ ticker: string; name: string; exchange: string }>> {
    try {
      const results = await yahooFinance.search(query)
      return results.quotes
        .filter((item) => item.isYahooFinance !== false)
        .slice(0, 20)
        .map((item) => ({
          ticker: item.symbol ?? "",
          name: item.longname ?? item.shortname ?? "",
          exchange: item.exchange ?? "",
        }))
    } catch (err) {
      throw new Error(
        `Failed to search tickers for "${query}": ${err instanceof Error ? err.message : "Unknown error"}`
      )
    }
  }

  async getFundamentalData(ticker: string): Promise<FundamentalData> {
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: ["summaryDetail", "defaultKeyStatistics", "financialData"],
      })

      const summary = (result.summaryDetail ?? {}) as Record<string, unknown>
      const stats = (result.defaultKeyStatistics ?? {}) as Record<string, unknown>
      const financial = (result.financialData ?? {}) as Record<string, unknown>

      return {
        ticker,
        peRatio: toNull(summary.trailingPE),
        pbRatio: toNull(stats.priceToBook),
        eps: toNull(summary.trailingEps),
        revenueGrowth: toNull(financial.revenueGrowth),
        profitMargin: toNull(financial.profitMargins),
        debtToEquity: toNull(financial.debtToEquity),
        roe: toNull(financial.returnOnEquity),
        currentRatio: toNull(financial.currentRatio),
        marketCap: toNull(summary.marketCap),
        dividendYield: toNull(summary.dividendYield),
      }
    } catch (err) {
      throw new Error(
        `Failed to fetch fundamentals for "${ticker}": ${err instanceof Error ? err.message : "Unknown error"}`
      )
    }
  }
}

export const yahooFinanceAdapter = new YahooFinanceAdapter()
