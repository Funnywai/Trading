import { IFundamentalAdapter } from "./interface"
import { FundamentalData } from "@/types"

function toNullNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

export class FMPAdapter implements IFundamentalAdapter {
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FMP_API_KEY || ""
    if (!this.apiKey) throw new Error("FMP_API_KEY is required")
  }

  async getFundamentalData(ticker: string): Promise<FundamentalData> {
    try {
      const encodedTicker = encodeURIComponent(ticker)
      const encodedKey = encodeURIComponent(this.apiKey)

      const profileUrl = `https://financialmodelingprep.com/stable/profile?symbol=${encodedTicker}&apikey=${encodedKey}`
      const metricsUrl = `https://financialmodelingprep.com/stable/key-metrics?symbol=${encodedTicker}&apikey=${encodedKey}&limit=1`

      const [profileRes, metricsRes] = await Promise.all([
        fetch(profileUrl),
        fetch(metricsUrl),
      ])

      if (!profileRes.ok) {
        throw new Error(`FMP profile API returned status ${profileRes.status}`)
      }

      const profileData = await profileRes.json()

      if (!Array.isArray(profileData) || profileData.length === 0) {
        throw new Error(`FMP returned no profile data for "${ticker}"`)
      }

      const profile = profileData[0] as Record<string, unknown>

      let metrics: Record<string, unknown> = {}
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json()
        if (Array.isArray(metricsData) && metricsData.length > 0) {
          metrics = metricsData[0] as Record<string, unknown>
        }
      } else if (metricsRes.status === 402 || metricsRes.status === 403) {
        console.error(`FMP key-metrics not available on free plan (status ${metricsRes.status}), using profile only`)
      } else {
        console.error(`FMP key-metrics returned status ${metricsRes.status}`)
      }

      return {
        ticker: String(profile.symbol ?? ticker),
        peRatio: toNullNumber(profile.peRatio),
        pbRatio: toNullNumber(profile.priceToBookRatio),
        eps: toNullNumber(profile.eps),
        revenueGrowth: toNullNumber(metrics.revenueGrowth),
        profitMargin: toNullNumber(metrics.netProfitMargin),
        debtToEquity: toNullNumber(metrics.debtToEquity),
        roe: toNullNumber(metrics.roe),
        currentRatio: toNullNumber(metrics.currentRatio),
        marketCap: toNullNumber(profile.mktCap),
        dividendYield: toNullNumber(metrics.dividendYield),
      }
    } catch (err) {
      throw new Error(
        `Failed to fetch fundamental data for "${ticker}": ${err instanceof Error ? err.message : "Unknown error"}`
      )
    }
  }
}

export const fmpAdapter = new FMPAdapter()
