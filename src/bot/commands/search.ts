import type { ChatInputCommandInteraction } from "discord.js"
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js"
import { DeepseekAdapter } from "@/adapters/llm/deepseek"
import { FinnhubAdapter } from "@/adapters/news/finnhub"
import { YahooFinanceAdapter } from "@/adapters/market-data/yahoo-finance"
import type { NewsArticle } from "@/types"

const SCAN_UNIVERSE = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD",
  "JPM", "GS", "V", "MA", "JNJ", "PFE", "MRNA", "UNH",
  "XOM", "CVX", "BA", "CAT", "DIS", "NFLX", "KO", "WMT",
  "TSM", "AVGO", "ORCL", "CRM", "ADBE", "INTC",
]

const SCAN_NEWS_LIMIT = 3
const SCAN_TOP_N = 12
const SCAN_DISPLAY_N = 6

interface StockSnapshot {
  ticker: string
  price: number
  changePercent: number
  news: NewsArticle[]
}

interface ScoredResult {
  ticker: string
  score: number
  rationale: string
  price: number
  changePercent: number
  newsHeadlines: string[]
}

export const searchCommand = new SlashCommandBuilder()
  .setName("search")
  .setDescription("掃描全市場新聞，LLM 評分找出最具潛力的股票")

export async function handleSearch(interaction: ChatInputCommandInteraction) {
  const t0 = Date.now()
  await interaction.deferReply()

  try {
    const newsAdapter = new FinnhubAdapter()
    const marketData = new YahooFinanceAdapter()
    const llm = new DeepseekAdapter()

    await interaction.editReply("📡 並行抓取 30 檔股票報價與新聞...")

    let completed = 0
    const results = await Promise.all(
      SCAN_UNIVERSE.map(async (ticker): Promise<StockSnapshot | null> => {
        try {
          const [quote, news] = await Promise.all([
            marketData.getQuote(ticker),
            newsAdapter.getNews(ticker, SCAN_NEWS_LIMIT),
          ])
          completed++
          if (completed % 10 === 0) {
            await interaction.editReply(`📡 正在抓取資料...（${completed}/${SCAN_UNIVERSE.length}）`).catch(() => {})
          }
          return {
            ticker,
            price: quote.currentPrice,
            changePercent: quote.changePercent,
            news,
          }
        } catch {
          completed++
          return null
        }
      })
    )

    const valid = results.filter(
      (r): r is StockSnapshot => r !== null && r.news.length > 0 && r.price > 0
    )

    if (valid.length === 0) {
      await interaction.editReply("❌ 未找到任何有效標的，請稍後再試。")
      return
    }

    await interaction.editReply(`📊 已抓取 ${valid.length} 檔有效標的，LLM 分析中...`)

    const stockDataLines = valid.map((s) => {
      const changeStr =
        s.changePercent >= 0
          ? `+${s.changePercent.toFixed(2)}%`
          : `${s.changePercent.toFixed(2)}%`
      const newsLines = s.news
        .slice(0, 3)
        .map((n) => `  • ${n.headline}`)
        .join("\n")
      return `${s.ticker} | $${s.price.toFixed(2)} | ${changeStr} |\n${newsLines}`
    })

    const systemPrompt = `你是一個專業的股票分析師。你將收到多檔股票的基本資料（價格、漲跌幅、近期新聞標題）。
請根據新聞內容的**重要性和正向/負向程度**、搭配價格動能，為每檔股票評分（1-10 分，10 為最高潛力）。

請只輸出以下 JSON 格式，不要加任何其他文字：
{
  "results": [
    { "ticker": "AAPL", "score": 7.2, "rationale": "一句中文理由..." }
  ]
}

評分標準：
- 8-10 分：重大利多新聞 + 強勁價格動能
- 5-7 分：中性偏多或新聞量中等
- 1-4 分：利空新聞或缺乏明確催化劑
- 如果標的的新聞很少或無關緊要，給予較低分數

請輸出 ${SCAN_TOP_N} 檔評分最高的股票，按分數降冪排序。`

    const userPrompt = `以下是要分析的標的清單：\n\n${stockDataLines.join("\n\n")}\n\n請根據上述標準，選出 ${SCAN_TOP_N} 檔最具潛力的股票並評分，按分數降冪排序。`

    const llmResult = await llm.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3, responseSchema: {}, maxTokens: 4096 }
    )

    let parsed: { ticker: string; score: number; rationale: string }[]
    try {
      const json = JSON.parse(llmResult.content) as {
        results?: Array<{ ticker: string; score: number; rationale: string }>
      }
      parsed = (json.results ?? []).filter(
        (r) => r.ticker && typeof r.score === "number"
      )
    } catch {
      await interaction.editReply("❌ LLM 回應格式錯誤，請稍後再試。")
      return
    }

    if (parsed.length === 0) {
      await interaction.editReply("❌ LLM 未回傳任何有效結果。")
      return
    }

    const priceMap = new Map(valid.map((s) => [s.ticker, s]))
    const merged: ScoredResult[] = parsed.slice(0, SCAN_DISPLAY_N).map((r) => {
      const snap = priceMap.get(r.ticker)
      return {
        ...r,
        price: snap?.price ?? 0,
        changePercent: snap?.changePercent ?? 0,
        newsHeadlines: (snap?.news ?? []).map((n) => n.headline).slice(0, 2),
      }
    })

    const embeds = buildSearchEmbeds(merged, valid.length, llmResult.tokensUsed, Date.now() - t0)

    const components: ActionRowBuilder<ButtonBuilder>[] = []
    let row = new ActionRowBuilder<ButtonBuilder>()
    merged.forEach((r, i) => {
      if (i > 0 && i % 5 === 0) {
        components.push(row)
        row = new ActionRowBuilder<ButtonBuilder>()
      }
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`search_debate:${r.ticker}`)
          .setLabel(`🚀 ${r.ticker}`)
          .setStyle(ButtonStyle.Primary)
      )
    })
    if (row.components.length > 0) components.push(row)

    await interaction.editReply({ content: null, embeds, components })
  } catch (err) {
    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ 掃描失敗")
      .setColor(0xef4444)
      .setDescription(err instanceof Error ? err.message : "未知錯誤")
    await interaction.editReply({ content: null, embeds: [errorEmbed] }).catch(() => {})
  }
}

function buildSearchEmbeds(
  results: ScoredResult[],
  totalCount: number,
  tokensUsed: number,
  durationMs: number
): EmbedBuilder[] {
  const medalEmojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"]

  const descriptionLines: string[] = results.map((r, i) => {
    const changeStr =
      r.changePercent >= 0
        ? `▲${r.changePercent.toFixed(1)}%`
        : `▼${Math.abs(r.changePercent).toFixed(1)}%`
    const emoji = medalEmojis[i] ?? "📌"

    let block = `${emoji} **${r.ticker}**  ⭐ ${r.score.toFixed(1)}/10  $${r.price.toFixed(2)}  ${changeStr}\n`
    block += `> 理由：${r.rationale}\n`
    if (r.newsHeadlines.length > 0) {
      block += `> 新聞：\n`
      block += r.newsHeadlines.map((h) => `> • ${h}`).join("\n")
    }
    return block
  })

  const mainEmbed = new EmbedBuilder()
    .setTitle("📊 新聞掃描結果 — 潛力股排序")
    .setColor(0x8b5cf6)
    .setDescription(descriptionLines.join("\n\n"))
    .setFooter({
      text: `已掃描 ${totalCount} 檔有效標的 | ⏱ ${(durationMs / 1000).toFixed(1)}s | 🔢 ${tokensUsed.toLocaleString()} tokens`,
    })

  return [mainEmbed]
}
