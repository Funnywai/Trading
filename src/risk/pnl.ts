export interface PnLSummary {
  totalRuns: number
  approvedCount: number
  rejectedCount: number
  actionDistribution: Record<string, number>
  avgConviction: number
  avgDurationMs: number
  avgQualityScore: number
}

export function computePnLSummary(runs: Array<{
  tradeProposal?: string | null
  approvalDecision?: string | null
  durationMs?: number
  totalTokens?: number
}>): PnLSummary {
  let approvedCount = 0
  let rejectedCount = 0
  const actions: Record<string, number> = {}
  let totalDuration = 0

  runs.forEach((r) => {
    const ad = r.approvalDecision ? safeParse(r.approvalDecision) : null
    if (ad?.action === "APPROVED" || ad?.action === "RESIZED") approvedCount++
    else if (ad?.action === "REJECTED") rejectedCount++

    const tp = r.tradeProposal ? safeParse(r.tradeProposal) : null
    if (tp?.action && typeof tp.action === "string") {
      const a = tp.action
      actions[a] = (actions[a] ?? 0) + 1
    }

    totalDuration += r.durationMs ?? 0
  })

  return {
    totalRuns: runs.length,
    approvedCount,
    rejectedCount,
    actionDistribution: actions,
    avgConviction: 0,
    avgDurationMs: runs.length > 0 ? Math.round(totalDuration / runs.length) : 0,
    avgQualityScore: 0,
  }
}

function safeParse(json: string): Record<string, unknown> | null {
  try { return JSON.parse(json) }
  catch { return null }
}
