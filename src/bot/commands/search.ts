import type { ChatInputCommandInteraction } from "discord.js"
import { SlashCommandBuilder, EmbedBuilder } from "discord.js"
import { scanMarket } from "@/application/search-service"

export const searchCommand = new SlashCommandBuilder()
  .setName("search")
  .setDescription("掃描全市場新聞，LLM 評分找出最具潛力的股票")

export async function handleSearch(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply()

  try {
    const result = await scanMarket(async (message) => {
      await interaction.editReply(message).catch(() => {})
    })

    await interaction.editReply({ content: null, embeds: result.embeds, components: result.components })
  } catch (err) {
    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ 掃描失敗")
      .setColor(0xef4444)
      .setDescription(err instanceof Error ? err.message : "未知錯誤")
    await interaction.editReply({ content: null, embeds: [errorEmbed] }).catch(() => {})
  }
}
