import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js"
import { getUserPortfolio, buyStock, sellStock } from "@/db/portfolio-repo"
import { YahooFinanceAdapter } from "@/adapters/market-data/yahoo-finance"

export const buyCommand = new SlashCommandBuilder()
  .setName("buy")
  .setDescription("買入股票，新增至你的投資組合")
  .addStringOption((option) =>
    option.setName("ticker").setDescription("股票代碼（如 AAPL）").setRequired(true)
  )
  .addNumberOption((option) =>
    option.setName("shares").setDescription("買入股數").setRequired(true)
  )
  .addNumberOption((option) =>
    option.setName("price").setDescription("每股價格（留空則以即時股價成交）").setRequired(false)
  )

export const sellCommand = new SlashCommandBuilder()
  .setName("sell")
  .setDescription("賣出股票，從你的投資組合移除")
  .addStringOption((option) =>
    option.setName("ticker").setDescription("股票代碼（如 AAPL）").setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("shares").setDescription("賣出股數（或輸入 \"all\" 全賣）").setRequired(true)
  )
  .addNumberOption((option) =>
    option.setName("price").setDescription("每股價格（留空則以即時股價成交）").setRequired(false)
  )

async function resolveTradePrice(ticker: string, price: number | null): Promise<number> {
  if (price != null && price > 0) return price

  const yahoo = new YahooFinanceAdapter()
  const quote = await yahoo.getQuote(ticker)
  return quote.currentPrice
}

export async function handleBuy(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const ticker = interaction.options.getString("ticker", true).toUpperCase()
  const shares = interaction.options.getNumber("shares", true)
  const priceInput = interaction.options.getNumber("price")

  if (shares <= 0) {
    await interaction.editReply({ content: "股數必須大於 0。" })
    return
  }

  const portfolio = await getUserPortfolio(discordUserId)
  if (!portfolio) {
    await interaction.editReply({
      content: "尚未儲存投資組合。請先用 `/portfolio set` 設定。",
    })
    return
  }

  let resolvedPrice: number
  try {
    resolvedPrice = await resolveTradePrice(ticker, priceInput)
  } catch {
    await interaction.editReply({
      content: `無法取得 ${ticker} 即時報價，請手動輸入價格。`,
    })
    return
  }

  const totalCost = shares * resolvedPrice

  if (portfolio.cashBalance < totalCost) {
    const shortfall = totalCost - portfolio.cashBalance
    await interaction.editReply({
      content: `現金不足！需要 $${totalCost.toLocaleString()}，但目前現金餘額僅 $${portfolio.cashBalance.toLocaleString()}（短缺 $${shortfall.toLocaleString()}）。`,
    })
    return
  }

  const result = await buyStock(discordUserId, ticker, shares, resolvedPrice)

  if (!result.success) {
    await interaction.editReply({
      content: "買入失敗，請稍後再試。",
    })
    return
  }

  const embed = new EmbedBuilder()
    .setTitle(`買入 ${ticker}`)
    .setColor(0x22c55e)
    .addFields(
      { name: "股數", value: `${shares} 股`, inline: true },
      { name: "成交價", value: `$${resolvedPrice.toFixed(2)}`, inline: true },
      { name: "總金額", value: `$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline: true },
      { name: "剩餘現金", value: `$${result.cashAfter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline: true },
      { name: "總持倉成本", value: `$${result.costBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline: true },
    )
    .setFooter({ text: `${ticker} 已加入投資組合` })

  await interaction.editReply({ embeds: [embed] })
}

export async function handleSell(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })

  const discordUserId = interaction.user.id
  const ticker = interaction.options.getString("ticker", true).toUpperCase()
  const sharesStr = interaction.options.getString("shares", true).trim()
  const priceInput = interaction.options.getNumber("price")

  const portfolio = await getUserPortfolio(discordUserId)
  if (!portfolio) {
    await interaction.editReply({
      content: "尚未儲存投資組合。請先用 `/portfolio set` 設定。",
    })
    return
  }

  const holding = portfolio.holdings.find((h) => h.ticker === ticker)
  if (!holding) {
    await interaction.editReply({
      content: `你的投資組合中沒有 ${ticker} 持倉。`,
    })
    return
  }

  let shares: number
  if (sharesStr.toLowerCase() === "all") {
    shares = holding.shares
  } else {
    shares = parseFloat(sharesStr)
    if (isNaN(shares) || shares <= 0) {
      await interaction.editReply({ content: "股數格式無效，請輸入數字或 \"all\"。" })
      return
    }
    if (shares > holding.shares) {
      await interaction.editReply({
        content: `股數超過持倉。你持有 ${holding.shares} 股 ${ticker}，無法賣出 ${shares} 股。`,
      })
      return
    }
  }

  let resolvedPrice: number
  try {
    resolvedPrice = await resolveTradePrice(ticker, priceInput)
  } catch {
    await interaction.editReply({
      content: `無法取得 ${ticker} 即時報價，請手動輸入價格。`,
    })
    return
  }

  const result = await sellStock(discordUserId, ticker, shares, resolvedPrice)

  if (!result.success) {
    await interaction.editReply({
      content: "賣出失敗，請稍後再試。",
    })
    return
  }

  const isWin = result.realizedPnl > 0
  const isLoss = result.realizedPnl < 0
  const headerEmoji = isWin ? "🟢" : isLoss ? "🔴" : "⚫"
  const color = isWin ? 0x22c55e : isLoss ? 0xef4444 : 0x6b7280

  const remainingHolding = portfolio.holdings.find((h) => h.ticker === ticker)
  const remainingShares = remainingHolding
    ? (sharesStr.toLowerCase() === "all" ? 0 : remainingHolding.shares)
    : 0

  const embed = new EmbedBuilder()
    .setTitle(`${headerEmoji} 賣出 ${ticker}`)
    .setColor(color)
    .addFields(
      { name: "賣出股數", value: `${shares} / ${holding.shares} 股`, inline: true },
      { name: "成交價", value: `$${resolvedPrice.toFixed(2)}`, inline: true },
      { name: "總金額", value: `$${(shares * resolvedPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline: true },
      {
        name: "已實現損益",
        value: `${result.realizedPnl >= 0 ? "+" : ""}$${result.realizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        inline: true,
      },
      { name: "賣出後現金", value: `$${result.cashAfter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline: true },
      { name: "剩餘持倉", value: remainingShares > 0 ? `${remainingShares} 股 ${ticker}` : "已全數賣出", inline: true },
    )

  await interaction.editReply({ embeds: [embed] })
}
