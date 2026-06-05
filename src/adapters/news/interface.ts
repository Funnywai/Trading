import { NewsArticle } from "@/types"

export interface INewsAdapter {
  getNews(ticker: string, limit?: number): Promise<NewsArticle[]>
}
