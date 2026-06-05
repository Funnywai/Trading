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

  embeds.push(new EmbedBuilder()
    .setTitle("📋 決策細節")
    .setColor(0x6b7280)
    .addFields(
      { name: "證據強度", value: result.judgment.evidenceStrength, inline: true },
      { name: "分歧程度", value: result.judgment.disagreementLevel, inline: true },
      { name: "下次審查", value: result.judgment.nextReviewTrigger.slice(0, 256) || "無資料", inline: true },
    )
    .setFooter({ text: result.judgment.invalidationConditions.slice(0, 3).join(" | ") || "無否定條件" }))

  return { embeds }
}
