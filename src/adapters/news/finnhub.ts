import { INewsAdapter } from "./interface"
import { NewsArticle } from "@/types"

function getDateRange(daysBack: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - daysBack)
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  }
}

export class FinnhubAdapter implements INewsAdapter {
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FINNHUB_API_KEY || ""
    if (!this.apiKey) throw new Error("FINNHUB_API_KEY is required")
  }

  async getNews(ticker: string, limit = 10): Promise<NewsArticle[]> {
    const { from, to } = getDateRange(7)

    try {
      const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&token=${encodeURIComponent(this.apiKey)}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Finnhub API returned status ${response.status}`)
      }

      const data = await response.json() as any[]

      if (!Array.isArray(data)) {
        throw new Error("Finnhub API returned unexpected response format")
      }

      return data.slice(0, limit).map(
        (item): NewsArticle => ({
          headline: String(item.headline ?? ""),
          summary: String(item.summary ?? "").slice(0, 500),
          source: String(item.source ?? ""),
          url: String(item.url ?? ""),
          publishedAt: new Date((item.datetime as number) * 1000).toISOString(),
          sentiment: undefined,
        })
      )
    } catch (err) {
      throw new Error(
        `Failed to fetch news for "${ticker}": ${err instanceof Error ? err.message : "Unknown error"}`
      )
    }
  }
}

export { }
