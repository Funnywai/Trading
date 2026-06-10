import type { ChatInputCommandInteraction, ButtonInteraction } from "discord.js"
import {
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js"
import { DeepseekAdapter } from "@/adapters/llm/deepseek"
import { FinnhubAdapter } from "@/adapters/news/finnhub"
import { yahooFinanceAdapter, YahooFinanceAdapter } from "@/adapters/market-data/yahoo-finance"
import { runDebate } from "@/agents/debate/orchestrator"
import { formatProgressEmbed, formatResultEmbed } from "../formatter"
import { getUserPortfolio } from "@/db/portfolio-repo"

export const debateCommand = new SlashCommandBuilder()
  .setName("debate")
  .setDescription("Run multi-agent debate analysis on a US stock")
  .addStringOption((option) =>
    option.setName("ticker").setDescription("Stock ticker (e.g. AAPL)").setRequired(true)
  )
  .addNumberOption((option) =>
    option.setName("capital").setDescription("Portfolio total capital (for risk assessment)")
  )
  .addStringOption((option) =>
    option.setName("holdings")
      .setDescription("Holdings: TICKER:SHARES:COST,TICKER:SHARES:COST (e.g. AAPL:50:180,MSFT:30:350)")
  )

function parseHoldings(input: string): Array<{ ticker: string; shares: number; averageCost: number }> {
  return input.split(",").map((h) => {
    const [ticker, shares, cost] = h.trim().split(":")
    return { ticker: ticker.toUpperCase(), shares: parseFloat(shares), averageCost: parseFloat(cost) }
  }).filter((h) => !isNaN(h.shares) && !isNaN(h.averageCost))
}

async function debateCore(
  reply: { user: { id: string }; deferReply(): Promise<unknown>; editReply(content: unknown): Promise<unknown> },
  ticker: string,
  capital?: number | null,
  holdingsStr?: string | null,
) {
  await reply.deferReply()

  let progressLines: string[] = []
  let lastEdit = 0

  try {
    const llm = new DeepseekAdapter()
    const newsAdapter = new FinnhubAdapter()
    const fundamentalAdapter = yahooFinanceAdapter
    const marketData = new YahooFinanceAdapter()

    let portfolio: {
      totalValue: number
      holdings: Array<{ ticker: string; shares: number; averageCost: number }>
      cashRatio?: number
    } | undefined

    if (capital && capital > 0) {
      const holdings = holdingsStr ? parseHoldings(holdingsStr) : []
      const totalHoldingsValue = holdings.reduce((sum, h) => sum + h.shares * h.averageCost, 0)
      portfolio = {
        totalValue: capital,
        holdings,
        cashRatio: capital > 0 ? (capital - totalHoldingsValue) / capital : 0.2,
      }
    } else {
      const saved = await getUserPortfolio(reply.user.id)
      if (saved) {
        const totalHoldingsValue = saved.holdings.reduce((sum, h) => sum + h.shares * h.averageCost, 0)
        portfolio = {
          totalValue: saved.totalCapital,
          holdings: saved.holdings,
          cashRatio: saved.totalCapital > 0 ? saved.cashBalance / saved.totalCapital : 0.2,
        }
      }
    }

    const result = await runDebate(
      llm, newsAdapter, fundamentalAdapter, marketData, ticker,
      {
        portfolio,
        onProgress: (event) => {
          const line = `[${event.phase.toUpperCase()}] ${event.detail}`
          progressLines.push(line)
          if (progressLines.length > 15) progressLines = progressLines.slice(-15)

          const now = Date.now()
          if (now - lastEdit > 1000) {
            lastEdit = now
            reply.editReply(formatProgressEmbed(ticker, progressLines)).catch(() => {})
          }
        },
      }
    )

    await reply.editReply(formatProgressEmbed(ticker, progressLines)).catch(() => {})

    try {
      const { embeds } = formatResultEmbed(ticker, result)

      if (result.riskAssessment) {
        embeds[0].setFooter({
          text: `Risk: ${result.riskAssessment.riskScore}/100 | ${(result.durationMs / 1000).toFixed(1)}s | ${result.totalTokensUsed.toLocaleString()} tokens`,
        })
      }

      await reply.editReply({ content: null, embeds })
    } catch {
      const summary = [
        `**${ticker} — ${result.judgment.action}** (${(result.judgment.conviction * 100).toFixed(0)}%)`,
        `Evidence: ${result.judgment.evidenceStrength} | Disagreement: ${result.judgment.disagreementLevel}`,
        `\n${result.judgment.rationale.slice(0, 1500)}`,
        `\n⏱ ${(result.durationMs / 1000).toFixed(1)}s | 🔢 ${result.totalTokensUsed.toLocaleString()} tokens`,
      ].join("\n")
      await reply.editReply({ content: summary, embeds: [] })
    }
  } catch (err) {
    const errorEmbed = new EmbedBuilder()
      .setTitle(`❌ Analysis Failed — ${ticker}`)
      .setColor(0xef4444)
      .setDescription(err instanceof Error ? err.message : "Unknown error")
      .setFooter({ text: "Check API keys and try again" })

    await reply.editReply({ content: null, embeds: [errorEmbed] }).catch(() => {})
  }
}

export async function handleDebate(interaction: ChatInputCommandInteraction) {
  const ticker = interaction.options.getString("ticker", true).toUpperCase()
  const capital = interaction.options.getNumber("capital")
  const holdingsStr = interaction.options.getString("holdings")
  await debateCore(interaction, ticker, capital, holdingsStr)
}

export async function handleDebateFromButton(interaction: ButtonInteraction, ticker: string) {
  await debateCore(interaction, ticker.toUpperCase(), null, null)
}
