import { prisma } from "./client"

export interface PortfolioData {
  totalCapital: number
  cashBalance: number
  holdings: Array<{ ticker: string; shares: number; averageCost: number }>
}

export async function getUserPortfolio(discordUserId: string): Promise<PortfolioData | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { discordUserId },
    include: { holdings: true },
  })

  if (!portfolio) return null

  const costBasis = portfolio.holdings.reduce((sum, h) => sum + h.shares * h.averageCost, 0)

  if (portfolio.totalCapital === 0 && portfolio.cashBalance > 0) {
    const migratedCapital = portfolio.cashBalance
    const migratedCash = migratedCapital - costBasis
    await prisma.portfolio.update({
      where: { id: portfolio.id },
      data: { totalCapital: migratedCapital, cashBalance: migratedCash },
    })
    return {
      totalCapital: migratedCapital,
      cashBalance: migratedCash,
      holdings: portfolio.holdings.map((h) => ({
        ticker: h.ticker,
        shares: h.shares,
        averageCost: h.averageCost,
      })),
    }
  }

  return {
    totalCapital: portfolio.totalCapital,
    cashBalance: portfolio.cashBalance,
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
  const costBasis = holdings.reduce((sum, h) => sum + h.shares * h.averageCost, 0)
  const cashBalance = capital - costBasis

  await prisma.portfolio.upsert({
    where: { discordUserId },
    create: {
      discordUserId,
      name: discordUserId,
      totalCapital: capital,
      cashBalance,
      holdings: {
        create: holdings.length > 0 ? holdings.map((h) => ({
          ticker: h.ticker,
          shares: h.shares,
          averageCost: h.averageCost,
        })) : [],
      },
    },
    update: {
      totalCapital: capital,
      cashBalance,
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

export async function buyStock(
  discordUserId: string,
  ticker: string,
  shares: number,
  price: number
): Promise<{ success: boolean; cashAfter: number; costBasis: number }> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { discordUserId },
    include: { holdings: true },
  })

  if (!portfolio) return { success: false, cashAfter: 0, costBasis: 0 }

  const totalCost = shares * price

  if (portfolio.cashBalance < totalCost) {
    return { success: false, cashAfter: portfolio.cashBalance, costBasis: 0 }
  }

  const existing = portfolio.holdings.find((h) => h.ticker === ticker)

  const newCashBalance = portfolio.cashBalance - totalCost

  await prisma.$transaction(async (tx) => {
    if (existing) {
      const totalShares = existing.shares + shares
      const newAvgCost = ((existing.shares * existing.averageCost) + totalCost) / totalShares
      await tx.holding.update({
        where: { id: existing.id },
        data: { shares: totalShares, averageCost: newAvgCost },
      })
    } else {
      await tx.holding.create({
        data: {
          portfolioId: portfolio.id,
          ticker,
          shares,
          averageCost: price,
        },
      })
    }

    await tx.portfolio.update({
      where: { id: portfolio.id },
      data: { cashBalance: newCashBalance },
    })

    await tx.closedTrade.create({
      data: {
        portfolioId: portfolio.id,
        ticker,
        side: "BUY",
        shares,
        price,
        totalValue: totalCost,
      },
    })
  })

  const updatedHoldings = await prisma.holding.findMany({
    where: { portfolioId: portfolio.id },
  })
  const costBasis = updatedHoldings.reduce((sum, h) => sum + h.shares * h.averageCost, 0)

  return { success: true, cashAfter: newCashBalance, costBasis }
}

export async function sellStock(
  discordUserId: string,
  ticker: string,
  shares: number,
  price: number
): Promise<{ success: boolean; realizedPnl: number; cashAfter: number }> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { discordUserId },
    include: { holdings: true },
  })

  if (!portfolio) return { success: false, realizedPnl: 0, cashAfter: 0 }

  const holding = portfolio.holdings.find((h) => h.ticker === ticker)
  if (!holding || holding.shares < shares) {
    return { success: false, realizedPnl: 0, cashAfter: portfolio.cashBalance }
  }

  const totalProceeds = shares * price
  const realizedPnl = (price - holding.averageCost) * shares
  const newCashBalance = portfolio.cashBalance + totalProceeds

  await prisma.$transaction(async (tx) => {
    if (holding.shares === shares) {
      await tx.holding.delete({ where: { id: holding.id } })
    } else {
      await tx.holding.update({
        where: { id: holding.id },
        data: { shares: holding.shares - shares },
      })
    }

    await tx.portfolio.update({
      where: { id: portfolio.id },
      data: { cashBalance: newCashBalance },
    })

    await tx.closedTrade.create({
      data: {
        portfolioId: portfolio.id,
        ticker,
        side: "SELL",
        shares,
        price,
        totalValue: totalProceeds,
        realizedPnl,
      },
    })
  })

  return { success: true, realizedPnl, cashAfter: newCashBalance }
}

export async function getClosedTrades(discordUserId: string) {
  const portfolio = await prisma.portfolio.findUnique({
    where: { discordUserId },
    select: { id: true },
  })
  if (!portfolio) return []

  return prisma.closedTrade.findMany({
    where: { portfolioId: portfolio.id },
    orderBy: { createdAt: "desc" },
  })
}

export async function getWinRate(discordUserId: string): Promise<{ wins: number; losses: number; total: number; winRate: number }> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { discordUserId },
    select: { id: true },
  })
  if (!portfolio) return { wins: 0, losses: 0, total: 0, winRate: 0 }

  const sellTrades = await prisma.closedTrade.findMany({
    where: { portfolioId: portfolio.id, side: "SELL", realizedPnl: { not: null } },
  })

  const wins = sellTrades.filter((t) => (t.realizedPnl ?? 0) > 0).length
  const losses = sellTrades.filter((t) => (t.realizedPnl ?? 0) < 0).length
  const total = wins + losses
  const winRate = total > 0 ? wins / total : 0

  return { wins, losses, total, winRate }
}

export async function getRealizedPnl(discordUserId: string): Promise<number> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { discordUserId },
    select: { id: true },
  })
  if (!portfolio) return 0

  const result = await prisma.closedTrade.aggregate({
    where: { portfolioId: portfolio.id, side: "SELL", realizedPnl: { not: null } },
    _sum: { realizedPnl: true },
  })

  return result._sum.realizedPnl ?? 0
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
