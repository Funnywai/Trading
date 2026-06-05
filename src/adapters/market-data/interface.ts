import { PriceBar } from "@/types"

export interface IMarketDataAdapter {
  getQuote(ticker: string): Promise<{
    ticker: string
    name: string
    currentPrice: number
    previousClose: number
    change: number
    changePercent: number
    volume: number
    marketCap?: number
  }>

  getHistoricalPrices(
    ticker: string,
    interval: string,
    range: string
  ): Promise<PriceBar[]>

  searchTickers(query: string): Promise<Array<{ ticker: string; name: string; exchange: string }>>
}
