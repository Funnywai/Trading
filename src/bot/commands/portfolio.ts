import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js"
import { getUserPortfolio, saveUserPortfolio } from "@/db/portfolio-repo"

export const portfolioCommand = new SlashCommandBuilder()
  .setName("portfolio")
  .setDescription("Manage your portfolio")
  .addSubcommand((sub) =>
    sub.setName("show").setDescription("Show your saved portfolio")
  )
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Save your portfolio")
      .addNumberOption((option) =>
        option.setName("capital").setDescription("Total capital").setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("holdings")
          .setDescription("Holdings: TICKER:SHARES:COST,... (or \"-\" for none)")
          .setRequired(false)
      )
  )

function parseHoldings(input: string): Array<{ ticker: string; shares: number; averageCost: number }> {
  return input
    .split(",")
    .map((h) => {
      const [ticker, shares, cost] = h.trim().split(":")
      return { ticker: ticker.toUpperCase(), shares: parseFloat(shares), averageCost: parseFloat(cost) }
    })
    .filter((h) => !isNaN(h.shares) && !isNaN(h.averageCost))
}

export async function handlePortfolio(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand()
  const discordUserId = interaction.user.id

  if (subcommand === "show") {
    await interaction.deferReply({ ephemeral: true })

    const portfolio = await getUserPortfolio(discordUserId)

    if (!portfolio) {
      await interaction.editReply({
        content: "No portfolio saved yet. Use `/portfolio set` to save one.",
      })
      return
    }

    const holdingsValue = portfolio.holdings.reduce((sum, h) => sum + h.shares * h.averageCost, 0)
    const cash = portfolio.capital - holdingsValue

    const embed = new EmbedBuilder()
      .setTitle(`Portfolio — ${interaction.user.displayName}`)
      .setColor(0x3b82f6)
      .addFields(
        { name: "Total Capital", value: `$${portfolio.capital.toLocaleString()}`, inline: true },
        { name: "Holdings Value", value: `$${holdingsValue.toLocaleString()}`, inline: true },
        { name: "Cash", value: `$${cash.toLocaleString()} (${((cash / portfolio.capital) * 100).toFixed(0)}%)`, inline: true }
      )

    if (portfolio.holdings.length > 0) {
      embed.addFields({
        name: "Holdings",
        value: portfolio.holdings
          .map((h) => `${h.ticker}: ${h.shares} shares @ $${h.averageCost}`)
          .join("\n"),
      })
    }

    await interaction.editReply({ embeds: [embed] })
  }

  if (subcommand === "set") {
    const capital = interaction.options.getNumber("capital", true)
    const holdingsStr = interaction.options.getString("holdings")
    const holdings = holdingsStr && holdingsStr !== "-" ? parseHoldings(holdingsStr) : []

    if (capital <= 0) {
      await interaction.reply({ content: "Capital must be positive.", ephemeral: true })
      return
    }

    await interaction.deferReply({ ephemeral: true })

    await saveUserPortfolio(discordUserId, capital, holdings)

    const embed = new EmbedBuilder()
      .setTitle("Portfolio Saved")
      .setColor(0x22c55e)
      .setDescription(`Capital: $${capital.toLocaleString()}\n${holdings.length > 0 ? holdings.map((h) => `${h.ticker}: ${h.shares} shares @ $${h.averageCost}`).join("\n") : "No holdings (cash only)"}`)
      .setFooter({ text: "Your portfolio will be used automatically in /debate" })

    await interaction.editReply({ embeds: [embed] })
  }
}
