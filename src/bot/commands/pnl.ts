import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js"
import { getUserPortfolio } from "@/db/portfolio-repo"
import { YahooFinanceAdapter } from "@/adapters/market-data/yahoo-finance"

export const pnlCommand = new SlashCommandBuilder()
  .setName("pl")
  .setDescription("查看你投資組合的總損益與各標的報酬率")

interface HoldingPnl {
  ticker: string
  shares: number
  averageCost: number
  currentPrice: number
  marketValue: number
  pnl: number
  pnlPct: number
}

export async function handlePnl(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })

  const portfolio = await getUserPortfolio(interaction.user.id)

  if (!portfolio) {
    await interaction.editReply({
      content: "尚未儲存投資組合。請先用 `/portfolio set` 設定。",
    })
    return
  }

  if (portfolio.holdings.length === 0) {
    await interaction.editReply({
      content: `你的投資組合僅有現金 $${portfolio.capital.toLocaleString()}，無持倉損益。`,
    })
    return
  }

  const yahoo = new YahooFinanceAdapter()

  const holdingsPnl: HoldingPnl[] = []

  const results = await Promise.all(
    portfolio.holdings.map(async (h) => {
      try {
        const quote = await yahoo.getQuote(h.ticker)
        return { ticker: h.ticker, shares: h.shares, averageCost: h.averageCost, currentPrice: quote.currentPrice, ok: true as const }
      } catch {
        return { ticker: h.ticker, shares: h.shares, averageCost: h.averageCost, currentPrice: 0, ok: false as const }
      }
    })
  )

  for (const r of results) {
    if (!r.ok) {
      holdingsPnl.push({
        ticker: r.ticker,
        shares: r.shares,
        averageCost: r.averageCost,
        currentPrice: 0,
        marketValue: 0,
        pnl: 0,
        pnlPct: 0,
      })
      continue
    }
    const marketValue = r.shares * r.currentPrice
    const pnl = (r.currentPrice - r.averageCost) * r.shares
    const pnlPct = ((r.currentPrice - r.averageCost) / r.averageCost) * 100
    holdingsPnl.push({
      ticker: r.ticker,
      shares: r.shares,
      averageCost: r.averageCost,
      currentPrice: r.currentPrice,
      marketValue,
      pnl,
      pnlPct,
    })
  }

  holdingsPnl.sort((a, b) => b.pnl - a.pnl)

  const totalMarketValue = holdingsPnl.reduce((sum, h) => sum + h.marketValue, 0)
  const totalPnl = holdingsPnl.reduce((sum, h) => sum + h.pnl, 0)
  const holdingsCost = portfolio.holdings.reduce((sum, h) => sum + h.shares * h.averageCost, 0)
  const cash = portfolio.capital - holdingsCost
  const totalValue = totalMarketValue + cash

  const totalPnlPct = holdingsCost > 0 ? (totalPnl / holdingsCost) * 100 : 0
  const emoji = totalPnl >= 0 ? "🟢" : "🔴"
  const sign = totalPnl >= 0 ? "+" : ""

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} P&L — ${interaction.user.displayName}`)
    .setColor(totalPnl >= 0 ? 0x22c55e : 0xef4444)
    .addFields(
      {
        name: "總資產",
        value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n${sign}${totalPnlPct.toFixed(2)}%`,
        inline: true,
      },
      {
        name: "初始本金",
        value: `$${portfolio.capital.toLocaleString()}`,
        inline: true,
      },
      {
        name: "現金餘額",
        value: `$${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        inline: true,
      },
      {
        name: "持倉價值",
        value: `$${totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        inline: true,
      },
      {
        name: "總損益",
        value: `${sign}$${Math.abs(totalPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        inline: true,
      },
      {
        name: "總報酬率",
        value: `${sign}${totalPnlPct.toFixed(2)}%`,
        inline: true,
      },
    )

  const lines = holdingsPnl.map((h) => {
    if (h.currentPrice <= 0) return `⚫ ${h.ticker}: ${h.shares} 股 @ $${h.averageCost.toFixed(2)} — 無法取得報價`
    const hEmoji = h.pnl >= 0 ? "🟢" : "🔴"
    const hSign = h.pnl >= 0 ? "+" : ""
    return [
      `${hEmoji} **${h.ticker}**`,
      `${h.shares} 股 @ $${h.currentPrice.toFixed(2)}`,
      `${hSign}$${h.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${hSign}${h.pnlPct.toFixed(2)}%)`,
    ].join("  ")
  })

  embed.addFields({
    name: "各標的",
    value: lines.join("\n"),
  })

  const best = holdingsPnl.find((h) => h.currentPrice > 0 && h.pnl > 0)
  const worst = holdingsPnl.findLast((h) => h.currentPrice > 0 && h.pnl < 0)
  const footerParts: string[] = []
  if (best) footerParts.push(`最佳: ${best.ticker} (+$${best.pnl.toFixed(0)})`)
  if (worst) footerParts.push(`最差: ${worst.ticker} (-$${Math.abs(worst.pnl).toFixed(0)})`)
  if (footerParts.length > 0) embed.setFooter({ text: footerParts.join("  |  ") })

  await interaction.editReply({ embeds: [embed] })
}
