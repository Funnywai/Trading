import type { ChatInputCommandInteraction } from "discord.js"
import { SlashCommandBuilder } from "discord.js"
import { DeepseekAdapter } from "@/adapters/llm/deepseek"
import { FinnhubAdapter } from "@/adapters/news/finnhub"
import { yahooFinanceAdapter, YahooFinanceAdapter } from "@/adapters/market-data/yahoo-finance"
import { runDebate } from "@/agents/debate/orchestrator"
import { getUserPortfolio } from "@/db/portfolio-repo"
import { formatProgressEmbed, formatReviewResultEmbed } from "../formatter"

export const reviewCommand = new SlashCommandBuilder()
  .setName("review")
  .setDescription("對你所有持倉逐一辯論分析，生成投資組合決策報告")

export async function handleReview(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply()

  const portfolio = await getUserPortfolio(interaction.user.id)

  if (!portfolio) {
    await interaction.editReply({
      content: "尚未儲存投資組合。請先用 `/portfolio set` 設定。",
    })
    return
  }

  if (portfolio.holdings.length === 0) {
    await interaction.editReply({
      content: "你的投資組合僅有現金，無需審查。",
    })
    return
  }

  const holdings = portfolio.holdings
  const totalHoldingsValue = holdings.reduce((sum, h) => sum + h.shares * h.averageCost, 0)
  const cashRatio = portfolio.capital > 0 ? (portfolio.capital - totalHoldingsValue) / portfolio.capital : 0.2

  const fullPortfolio = {
    totalValue: portfolio.capital,
    holdings: holdings.map((h) => ({ ticker: h.ticker, shares: h.shares, averageCost: h.averageCost })),
    cashRatio,
  }

  const startTime = Date.now()
  let progressLines: string[] = []
  let lastEdit = 0

  const llm = new DeepseekAdapter()
  const newsAdapter = new FinnhubAdapter()
  const marketData = new YahooFinanceAdapter()

  const results: Array<{
    ticker: string
    shares: number
    averageCost: number
    success: boolean
    currentPrice: number
    action: string
    conviction: number
    evidenceStrength: string
    rationale: string
    riskScore: number | null
    entryPrice?: number
    targetPrice?: number
    stopLoss?: number
    error?: string
    warnings?: string[]
    positionSizePercent?: number
    suggestedShares?: number
  }> = []

  for (let i = 0; i < holdings.length; i++) {
    const holding = holdings[i]
    const prefix = holdings.length > 1 ? `(${i + 1}/${holdings.length}) ` : ""

    try {
      const result = await runDebate(
        llm, newsAdapter, yahooFinanceAdapter, marketData, holding.ticker,
        {
          portfolio: fullPortfolio,
          onProgress: (event) => {
            const line = `[${event.phase.toUpperCase()}] ${event.detail}`
            progressLines.push(line)
            if (progressLines.length > 15) progressLines = progressLines.slice(-15)

            const now = Date.now()
            if (now - lastEdit > 1000) {
              lastEdit = now
              interaction.editReply(formatProgressEmbed(`${prefix}${holding.ticker}`, progressLines)).catch(() => {})
            }
          },
        }
      )

      const positionSizePercent = result.judgment.positionSizePercent
      const suggestedShares = positionSizePercent !== undefined && result.judgment.entryPrice !== undefined && result.judgment.entryPrice > 0
        ? Math.floor(portfolio.capital * (positionSizePercent / 100) / result.judgment.entryPrice)
        : undefined

      results.push({
        ticker: holding.ticker,
        shares: holding.shares,
        averageCost: holding.averageCost,
        success: true,
        currentPrice: result.currentPrice,
        action: result.judgment.action,
        conviction: result.judgment.conviction,
        evidenceStrength: result.judgment.evidenceStrength,
        rationale: result.judgment.rationale,
        riskScore: result.riskAssessment?.riskScore ?? null,
        entryPrice: result.judgment.entryPrice,
        targetPrice: result.judgment.targetPrice,
        stopLoss: result.judgment.stopLoss,
        warnings: result.judgment.dataQualityWarning?.length ? result.judgment.dataQualityWarning : undefined,
        positionSizePercent,
        suggestedShares,
      })
    } catch (err) {
      results.push({
        ticker: holding.ticker,
        shares: holding.shares,
        averageCost: holding.averageCost,
        success: false,
        currentPrice: 0,
        action: "FAILED",
        conviction: 0,
        evidenceStrength: "N/A",
        rationale: err instanceof Error ? err.message : "Unknown error",
        riskScore: null,
        error: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const totalDurationMs = Date.now() - startTime

  await interaction.editReply(formatProgressEmbed("Review", progressLines)).catch(() => {})
  await interaction.editReply(formatReviewResultEmbed(interaction.user.displayName, results, totalDurationMs)).catch(() => {})
}
