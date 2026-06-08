import "dotenv/config"

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
} from "discord.js"
import { debateCommand, handleDebate, handleDebateFromButton } from "./commands/debate"
import { portfolioCommand, handlePortfolio } from "./commands/portfolio"
import { searchCommand, handleSearch } from "./commands/search"
import { pnlCommand, handlePnl } from "./commands/pnl"
import { reviewCommand, handleReview } from "./commands/review"
import { helpCommand, handleHelp } from "./commands/help"

const TOKEN = process.env.DISCORD_BOT_TOKEN
const CLIENT_ID = process.env.DISCORD_CLIENT_ID

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in .env")
  console.error("Get them at https://discord.com/developers/applications")
  process.exit(1)
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
})

const commands = [
  debateCommand.toJSON(),
  portfolioCommand.toJSON(),
  searchCommand.toJSON(),
  pnlCommand.toJSON(),
  reviewCommand.toJSON(),
  helpCommand.toJSON(),
]

// Register slash commands on startup
const rest = new REST({ version: "10" }).setToken(TOKEN)
;(async () => {
  try {
    console.log("Registering slash commands...")
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands })
    console.log("Slash commands registered")
  } catch (err) {
    console.error("Failed to register slash commands:", err)
  }
})()

// Handle interactions
client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("search_debate:")) {
      const ticker = interaction.customId.split(":")[1]
      await handleDebateFromButton(interaction, ticker)
    }
    return
  }

  if (!interaction.isChatInputCommand()) return

  if (interaction.commandName === "debate") {
    await handleDebate(interaction)
  } else if (interaction.commandName === "portfolio") {
    await handlePortfolio(interaction)
  } else if (interaction.commandName === "search") {
    await handleSearch(interaction)
  } else if (interaction.commandName === "pl") {
    await handlePnl(interaction)
  } else if (interaction.commandName === "review") {
    await handleReview(interaction)
  } else if (interaction.commandName === "help") {
    await handleHelp(interaction)
  }
})

client.once("ready", () => {
  console.log(`Bot ready — logged in as ${client.user?.tag}`)
})

client.login(TOKEN)
