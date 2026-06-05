import { FundamentalData } from "@/types"

export interface IFundamentalAdapter {
  getFundamentalData(ticker: string): Promise<FundamentalData>
}
