import { prisma } from "./client"

export interface PortfolioData {
  capital: number
  holdings: Array<{ ticker: string; shares: number; averageCost: number }>
}

export async function getUserPortfolio(discordUserId: string): Promise<PortfolioData | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { discordUserId },
    include: { holdings: true },
  })

  if (!portfolio) return null

  return {
    capital: portfolio.cashBalance,
    holdings: portfolio.holdings.map((h) => ({
      ticker: h.ticker,
      shares: h.shares,
      averageCost: h.averageCost,
    })),
  }
}

export async function saveUserPortfolio(
  discordUserId: string,
  capital: number,
  holdings: Array<{ ticker: string; shares: number; averageCost: number }>
): Promise<void> {
  await prisma.portfolio.upsert({
    where: { discordUserId },
    create: {
      discordUserId,
      name: discordUserId,
      cashBalance: capital,
      holdings: {
        create: holdings.length > 0 ? holdings.map((h) => ({
          ticker: h.ticker,
          shares: h.shares,
          averageCost: h.averageCost,
        })) : [],
      },
    },
    update: {
      cashBalance: capital,
      holdings: {
        deleteMany: {},
        create: holdings.length > 0 ? holdings.map((h) => ({
          ticker: h.ticker,
          shares: h.shares,
          averageCost: h.averageCost,
        })) : [],
      },
    },
  })
}

export async function saveRunHistory(params: {
  ticker: string
  thesis: string
  researchMemo?: string
  tradeProposal?: string
  approvalDecision?: string
  executionResult?: string
  alerts?: string
  totalTokens: number
  durationMs: number
}) {
  try {
    await prisma.runHistory.create({ data: params })
  } catch (e) {
    console.error("Failed to save run history:", e)
  }
}

export async function getRecentRuns(limit = 20) {
  return prisma.runHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, ticker: true, thesis: true, tradeProposal: true, approvalDecision: true, durationMs: true, totalTokens: true, createdAt: true },
  })
}

export async function getRunById(id: string) {
  return prisma.runHistory.findUnique({ where: { id } })
}

export async function addRunNote(id: string, notes: string) {
  return prisma.runHistory.update({ where: { id }, data: { notes } })
}

export async function getRunStats() {
  return prisma.runHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { tradeProposal: true, approvalDecision: true, durationMs: true, totalTokens: true, createdAt: true },
  })
}
