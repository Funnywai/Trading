import { EmbedBuilder } from "discord.js"
import { DebateResult } from "@/types"

export function formatProgressEmbed(ticker: string, lines: string[]): { embeds: EmbedBuilder[] } {
  const embed = new EmbedBuilder()
    .setTitle(`🔍 分析 ${ticker}...`)
    .setColor(0x3b82f6)
    .setDescription(lines.slice(-10).join("\n") || "初始化中...")
    .setFooter({ text: `最後更新: ${new Date().toLocaleTimeString()}` })

  return { embeds: [embed] }
}

export function formatResultEmbed(ticker: string, result: DebateResult): { embeds: EmbedBuilder[] } {
  const embeds: EmbedBuilder[] = []

  // Main result embed
  const actionEmoji = result.judgment.action === "ADD_SMALL" ? "🟢"
    : result.judgment.action === "EXIT" || result.judgment.action === "REDUCE" ? "🔴"
    : result.judgment.action === "HOLD" ? "🔵" : "🟡"

  const mainEmbed = new EmbedBuilder()
    .setTitle(`${actionEmoji} ${ticker} — ${result.judgment.action}`)
    .setColor(result.judgment.action === "ADD_SMALL" ? 0x22c55e
      : result.judgment.action === "EXIT" || result.judgment.action === "REDUCE" ? 0xef4444
      : result.judgment.action === "HOLD" ? 0x3b82f6 : 0xf59e0b)
    .setDescription(result.judgment.rationale.slice(0, 1000))
    .addFields(
      { name: "方向", value: result.thesis.direction, inline: true },
      { name: "信心度", value: `${(result.judgment.conviction * 100).toFixed(0)}%`, inline: true },
      { name: "證據力", value: result.judgment.evidenceStrength, inline: true },
    )

  if (result.tradeProposal) {
    const tp = result.tradeProposal
    const fields = []
    if (tp.side !== "NONE") fields.push(`方向: ${tp.side}`)
    if (tp.entryBand) fields.push(`進場: $${tp.entryBand.lower}–$${tp.entryBand.upper}`)
    if (tp.targetPrice) fields.push(`止盈: $${tp.targetPrice}`)
    if (tp.stopLoss) fields.push(`止損: $${tp.stopLoss}`)
    if (tp.maxPositionSizePct) fields.push(`倉位: ${tp.maxPositionSizePct}%`)
    if (fields.length > 0) mainEmbed.addFields({ name: "交易提案", value: fields.join(" | "), inline: true })
  }

  if (result.riskAssessment) {
    mainEmbed.addFields(
      { name: "風險評分", value: `${result.riskAssessment.riskScore}/100`, inline: true },
      { name: "最大倉位", value: `$${result.riskAssessment.maxPositionSize.toLocaleString()}`, inline: true },
    )
    if (result.riskAssessment.warnings.length > 0) {
      mainEmbed.addFields({ name: "警告", value: result.riskAssessment.warnings.slice(0, 3).map((w) => `⚠ ${w}`).join("\n") || "無" })
    }
  }

  if (result.approvalDecision && result.approvalDecision.action !== "APPROVED") {
    const ad = result.approvalDecision
    mainEmbed.addFields({
      name: `⚠ 審核結果: ${ad.action}`,
      value: ad.rejectionReasons.join("\n") || "無拒絕原因",
    })
  }

  mainEmbed.addFields(
    { name: "Token 數", value: result.totalTokensUsed.toLocaleString(), inline: true },
    { name: "耗時", value: `${(result.durationMs / 1000).toFixed(1)}s`, inline: true },
  )

  embeds.push(mainEmbed)

  // Thesis + Debate Summary embed
  const thesisText = `**論點:** ${result.thesis.thesis}\n\n**多方:** ${result.judgment.bullSummary.slice(0, 3).join("\n") || "無資料"}\n\n**空方:** ${result.judgment.bearSummary.slice(0, 3).join("\n") || "無資料"}`
  if (thesisText.length > 800) {
    embeds.push(new EmbedBuilder()
      .setTitle("📊 論點與辯論")
      .setColor(0x6b7280)
      .setDescription(thesisText.slice(0, 1000)))
  } else {
    mainEmbed.addFields({ name: "辯論", value: thesisText.slice(0, 1000) })
  }

  // Enforcement warnings
  const enforcements = result.judgment.dataQualityWarning.filter((w) => w.startsWith("enforce:"))
  if (enforcements.length > 0) {
    embeds.push(new EmbedBuilder()
      .setTitle("🛡 政策強制執行")
      .setColor(0xef4444)
      .setDescription(enforcements.slice(0, 5).join("\n")))
  }

  const detailEmbed = new EmbedBuilder()
    .setTitle("📋 決策細節")
    .setColor(0x6b7280)
    .addFields(
      { name: "證據強度", value: result.judgment.evidenceStrength, inline: true },
      { name: "分歧程度", value: result.judgment.disagreementLevel, inline: true },
      { name: "下次審查", value: result.judgment.nextReviewTrigger.slice(0, 256) || "無資料", inline: true },
    )

  const priceFields: string[] = []
  if (result.judgment.entryPrice) priceFields.push(`入場: $${result.judgment.entryPrice}`)
  if (result.judgment.targetPrice) priceFields.push(`止盈: $${result.judgment.targetPrice}`)
  if (result.judgment.stopLoss) priceFields.push(`止損: $${result.judgment.stopLoss}`)
  if (priceFields.length > 0) {
    detailEmbed.addFields({ name: "價格區間", value: priceFields.join("  |  ") })
  }

  detailEmbed.setFooter({ text: result.judgment.invalidationConditions.slice(0, 3).join(" | ") || "無否定條件" })

  embeds.push(detailEmbed)

  return { embeds }
}

export function formatReviewResultEmbed(
  displayName: string,
  results: Array<{
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
  }>,
  totalDurationMs: number,
): { embeds: EmbedBuilder[] } {
  const embeds: EmbedBuilder[] = []

  let actionAdd = 0
  let actionHold = 0
  let actionObserve = 0
  let actionReduce = 0
  let actionFail = 0

  const mainEmbed = new EmbedBuilder()
    .setTitle(`📊 投資組合審查 — ${displayName}`)
    .setColor(0x3b82f6)

  for (const r of results) {
    const actionEmoji = r.action === "ADD_SMALL" ? "🟢"
      : r.action === "EXIT" || r.action === "REDUCE" ? "🔴"
      : r.action === "HOLD" ? "🔵"
      : r.action === "FAILED" ? "❌"
      : "🟡"

    if (r.action === "ADD_SMALL") actionAdd++
    else if (r.action === "EXIT" || r.action === "REDUCE") actionReduce++
    else if (r.action === "HOLD") actionHold++
    else if (r.action === "FAILED") actionFail++
    else actionObserve++

    if (r.success) {
      const pnl = r.currentPrice > 0 ? (r.currentPrice - r.averageCost) * r.shares : 0
      const pnlPct = r.averageCost > 0 ? ((r.currentPrice - r.averageCost) / r.averageCost) * 100 : 0
      const pnlSign = pnl >= 0 ? "+" : ""
      const parts: string[] = []
      parts.push(`持有: ${r.shares} 股 @ $${r.averageCost.toFixed(2)}`)
      if (r.currentPrice > 0) parts.push(`現價: $${r.currentPrice.toFixed(2)}  (${pnlSign}$${pnl.toFixed(0)}, ${pnlSign}${pnlPct.toFixed(2)}%)`)
      parts.push(`證據力: ${r.evidenceStrength}`)

      const priceParts: string[] = []
      const isAddSmall = r.action === "ADD_SMALL"
      const hasPrice = r.currentPrice > 0

      if (isAddSmall) {
        if (r.entryPrice) priceParts.push(`入場: $${r.entryPrice}`)
      }

      if (r.targetPrice && hasPrice) {
        const ratio = r.targetPrice / r.currentPrice
        const costBased = r.averageCost * ratio
        priceParts.push(`止盈: $${costBased.toFixed(2)}`)
      }
      if (r.stopLoss && hasPrice) {
        const ratio = r.stopLoss / r.currentPrice
        const costBased = r.averageCost * ratio
        priceParts.push(`止損: $${costBased.toFixed(2)}`)
      }

      if (isAddSmall) {
        if (r.positionSizePercent !== undefined && r.suggestedShares !== undefined && r.suggestedShares > 0) {
          priceParts.push(`倉位: ${r.positionSizePercent}% ≈ ${r.suggestedShares} 股`)
        }
      }

      const valueLines = [
        `**${r.action}** (${(r.conviction * 100).toFixed(0)}%)`,
        parts.join(" | "),
        r.rationale.slice(0, 300),
      ]
      if (priceParts.length > 0) valueLines.push(priceParts.join(" | "))
      if (r.riskScore !== null) valueLines.push(`Risk: ${r.riskScore}/100`)
      if (r.warnings && r.warnings.length > 0) {
        const llmWarnings = r.warnings.filter((w) => !w.startsWith("enforce:"))
        if (llmWarnings.length > 0) valueLines.push(`⚠ ${llmWarnings.join(" | ")}`)
      }

      mainEmbed.addFields({
        name: `${actionEmoji} ${r.ticker}`,
        value: valueLines.join("\n"),
      })
    } else {
      mainEmbed.addFields({
        name: `❌ ${r.ticker} — FAILED`,
        value: r.error ?? "Unknown error",
      })
    }
  }

  const summaryParts: string[] = []
  summaryParts.push(`✅ 增持: ${actionAdd}`)
  summaryParts.push(`🔵 持有: ${actionHold}`)
  summaryParts.push(`🟡 觀察: ${actionObserve}`)
  summaryParts.push(`❌ 失敗: ${actionFail}`)
  if (actionReduce > 0) summaryParts.push(`🔴 減持: ${actionReduce}`)

  mainEmbed.addFields({
    name: "📋 總覽",
    value: summaryParts.join("  |  "),
  })

  mainEmbed.setFooter({
    text: `⏱ ${(totalDurationMs / 1000).toFixed(0)}s`,
  })

  embeds.push(mainEmbed)
  return { embeds }
}
