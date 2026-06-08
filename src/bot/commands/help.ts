import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js"

export const helpCommand = new SlashCommandBuilder()
  .setName("help")
  .setDescription("顯示所有指令與使用說明")

export async function handleHelp(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle("Trading AI — 指令說明")
    .setColor(0x3b82f6)
    .setDescription("以下是所有可用指令：")
    .addFields(
      {
        name: "/debate <ticker>",
        value: "對指定美股執行完整 13 節點多智能體辯論分析\n選填：`capital`（本金）、`holdings`（持倉）\n範例：`/debate AAPL capital:100000 holdings:AAPL:50:180`",
      },
      {
        name: "/review",
        value: "對你所有持倉逐一辯論分析，生成投資組合決策報告\n會跑完整 debate pipeline，耗時約 2 分鐘 / 檔",
      },
      {
        name: "/pl",
        value: "顯示你投資組合的總損益與各標的報酬率\n（查詢即時股價計算未實現損益）",
      },
      {
        name: "/portfolio show",
        value: "顯示你已儲存的投資組合（持倉 + 現金）",
      },
      {
        name: "/portfolio set <capital> [holdings]",
        value: "儲存你的投資組合到資料庫\n範例：`/portfolio set capital:100000 holdings:AAPL:50:180,MSFT:30:350`\n`holdings` 格式：`TICKER:SHARES:COST,...`，用 `-` 表示無持倉",
      },
      {
        name: "/search",
        value: "掃描 30 檔重點股的新聞與報價，LLM 評分後回傳 Top 6 結果\n點擊按鈕可直接啟動該標的的完整辯論分析",
      },
      {
        name: "/help",
        value: "顯示此說明",
      },
    )
    .setFooter({ text: "所有分析由 DeepSeek v4-flash 驅動 | 13-agent LangGraph 工作流" })

  await interaction.reply({ embeds: [embed], ephemeral: true })
}
