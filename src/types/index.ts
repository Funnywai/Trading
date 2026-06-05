export type Direction = "BULLISH" | "BEARISH"

export type Action = "BUY" | "SELL" | "HOLD"

export type DecisionAction = "ADD_SMALL" | "HOLD" | "REDUCE" | "EXIT" | "OBSERVE" | "NO_ACTION"

export type EvidenceStrength = "WEAK" | "MODERATE" | "STRONG"
export type DisagreementLevel = "LOW" | "MEDIUM" | "HIGH"
export type DataFreshness = "fresh" | "delayed" | "stale"

export interface PriceBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface PortfolioHolding {
  ticker: string
  name: string
  shares: number
  averageCost: number
  currentPrice: number
  marketValue: number
  allocation: number
}

export interface RiskMetrics {
  var95: number
  var99: number
  cvar95: number
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  volatility: number
  beta: number
  alpha: number
  trackingError: number
  informationRatio: number
}

export interface NewsArticle {
  headline: string
  summary: string
  source: string
  url: string
  publishedAt: string
  sentiment?: "POSITIVE" | "NEGATIVE" | "NEUTRAL"
}

export interface NewsItem extends NewsArticle {
  sourceType?: "wire" | "blog" | "analyst" | "social" | "unknown"
  noveltyScore?: number
  relevanceScore?: number
  isOpinionPiece?: boolean
  eventType?: "earnings" | "product" | "regulatory" | "macro" | "corporate" | "other"
}

export interface FundamentalData {
  ticker: string
  peRatio: number | null
  pbRatio: number | null
  eps: number | null
  revenueGrowth: number | null
  profitMargin: number | null
  debtToEquity: number | null
  roe: number | null
  currentRatio: number | null
  marketCap: number | null
  dividendYield: number | null
}

export interface FundamentalSnapshot extends FundamentalData {
  fetchedAt: string
  staleness: DataFreshness
  earningsWithinDays?: number
  historicalPE?: number[]
  historicalRevenue?: number[]
  historicalEPS?: number[]
  industryAvgPE?: number
}

export interface MarketSnapshot {
  price: number
  changePct: number
  volatility30d: number
  dataFreshness: DataFreshness
}

export interface DataQuality {
  newsCount: number
  missingFundamentalFields: string[]
  staleFlags: string[]
  qualityScore: number
}

export interface Thesis {
  ticker: string
  direction: Direction
  thesis: string
  confidence: number
  keyPoints: string[]
}

export interface AgentArgument {
  agentId: string
  agentName: string
  position: "SUPPORT" | "OPPOSE" | "NEUTRAL"
  arguments: string[]
  evidence: string[]
  confidence: number
}

export interface DebateRound {
  round: number
  thesis: Thesis
  arguments: AgentArgument[]
}

export interface EvidenceGateOutput {
  unsupportedClaims: string[]
  temporalMismatches: string[]
  metricMismatches: string[]
  duplicatedEvidenceIds: string[]
  evidenceCoverageScore: number
  counterEvidenceCoverage: number
  canProceedToFinal: boolean
  summary: string
}

export interface RiskAssessment {
  maxPositionSize: number
  suggestedStopLoss: number
  portfolioImpact: string
  warnings: string[]
  riskScore: number
}

export interface FinalJudgment {
  ticker: string
  action: DecisionAction
  conviction: number
  rationale: string
  debateSummary: string
  bullSummary: string[]
  bearSummary: string[]
  keyEvidenceIds: string[]
  evidenceStrength: EvidenceStrength
  disagreementLevel: DisagreementLevel
  dataQualityWarning: string[]
  entryPrice?: number
  stopLoss?: number
  positionSizePercent?: number
  invalidationConditions: string[]
  nextReviewTrigger: string
}

export interface DebateResult {
  ticker: string
  currentPrice: number
  thesis: Thesis
  rounds: DebateRound[]
  riskAssessment: RiskAssessment | null
  judgment: FinalJudgment
  researchMemo?: ResearchMemo
  tradeProposal?: TradeProposal
  approvalDecision?: ApprovalDecision
  totalTokensUsed: number
  durationMs: number
}

export interface ResearchMemo {
  ticker: string
  direction: "BULLISH" | "BEARISH" | "NEUTRAL"
  bullCase: string[]
  bearCase: string[]
  evidenceMatrix: Record<string, string[]>
  conviction: number
  keyUncertainties: string[]
  nextReviewTrigger: string
  summary: string
}

export interface TradeProposal {
  ticker: string
  side: "LONG" | "SHORT" | "NONE"
  action: DecisionAction
  entryBand?: { lower: number; upper: number }
  stopLoss?: number
  targetPrice?: number
  timeHorizon: string
  maxPositionSizePct?: number
  sizingRationale: string
  expectedCatalysts: string[]
  invalidationConditions: string[]
  thesisId: string
}

export interface ApprovalDecision {
  action: "APPROVED" | "REJECTED" | "RESIZED"
  approvedBy: string
  originalSize?: number
  adjustedSize?: number
  rejectionReasons: string[]
  overrideReasons: string[]
  approvedAt: string
}

export interface AgentRunResult<T> {
  success: boolean
  data?: T
  error?: string
  tokensUsed: number
  durationMs: number
}

export interface BacktestTrade {
  date: string
  ticker: string
  action: Action
  price: number
  shares: number
  pnl?: number
}

export interface BacktestResult {
  totalReturn: number
  annualizedReturn: number
  maxDrawdown: number
  sharpeRatio: number
  winRate: number
  totalTrades: number
  trades: BacktestTrade[]
}

export interface OptimizationResult {
  weights: Record<string, number>
  expectedReturn: number
  volatility: number
  sharpeRatio: number
  efficientFrontier: Array<{ volatility: number; return: number }>
}

export interface ProgressEvent {
  phase: string
  detail: string
  timestamp?: number
  node?: string
  status?: "running" | "done" | "skipped" | "error"
  durationMs?: number
  round?: number
  earlyStopReason?: string
}

export interface MacroData {
  spyChange: number
  qqqChange: number
  vixLevel: number
  us10y: number
  dxy: number
  oil: number
  marketRegime: "RISK_ON" | "RISK_OFF" | "NEUTRAL"
  sectorRotation: string
}

export interface ExecutionSimResult {
  orderId: string
  side: "LONG" | "SHORT" | "NONE"
  targetPrice: number
  avgFillPrice: number
  fillPct: number
  slippageBps: number
  estimatedCommission: number
  totalExecutionCost: number
  fillTimeline: string
  liquidityWarning?: string
}
