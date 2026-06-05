import { StateGraph, Annotation, START, END } from "@langchain/langgraph"

import { ILLMAdapter } from "@/adapters/llm/interface"
import { INewsAdapter } from "@/adapters/news/interface"
import { IFundamentalAdapter } from "@/adapters/fundamental/interface"
import { IMarketDataAdapter } from "@/adapters/market-data/interface"

import { runMainThesis } from "@/agents/main/runner"
import { runBullResearcher } from "@/agents/bull-researcher/runner"
import { runBearResearcher } from "@/agents/bear-researcher/runner"
import { runResearchManager } from "@/agents/research-manager/runner"
import { runTrader } from "@/agents/trader/runner"
import { runRiskAgent } from "@/agents/risk/runner"
import { runVerifierAgent } from "@/agents/verifier/runner"
import { runAnalystPass } from "@/agents/analyst-pass/runner"

import { computeAllRiskMetrics } from "@/risk/metrics"
import { computeConcentrationRisk } from "@/risk/concentration"
import { enforceDecisionPolicy } from "@/risk/enforcement"
import { simulateExecution } from "@/risk/execution"
import { generateAlerts } from "@/risk/alert-engine"
import { saveRunHistory } from "@/db/portfolio-repo"
import { extractCloses } from "@/lib/utils"

import {
  DebateResult, AgentArgument, RiskAssessment, RiskMetrics,
  FundamentalData, NewsArticle, PriceBar, Thesis, FinalJudgment,
  DataQuality, EvidenceGateOutput, ProgressEvent,
  ResearchMemo, TradeProposal, ApprovalDecision,
  MacroData, ExecutionSimResult,
} from "@/types"

const DEFAULT_FUNDAMENTALS: FundamentalData = {
  ticker: "",
  peRatio: null, pbRatio: null, eps: null, revenueGrowth: null,
  profitMargin: null, debtToEquity: null, roe: null,
  currentRatio: null, marketCap: null, dividendYield: null,
}

function buildFundamentalsSummary(data: FundamentalData): string {
  const parts: string[] = []
  if (data.peRatio !== null) parts.push(`P/E: ${data.peRatio.toFixed(2)}`)
  if (data.pbRatio !== null) parts.push(`P/B: ${data.pbRatio.toFixed(2)}`)
  if (data.eps !== null) parts.push(`EPS: $${data.eps.toFixed(2)}`)
  if (data.revenueGrowth !== null) parts.push(`Revenue Growth: ${(data.revenueGrowth * 100).toFixed(1)}%`)
  if (data.profitMargin !== null) parts.push(`Profit Margin: ${(data.profitMargin * 100).toFixed(1)}%`)
  if (data.debtToEquity !== null) parts.push(`D/E: ${data.debtToEquity.toFixed(2)}`)
  if (data.roe !== null) parts.push(`ROE: ${(data.roe * 100).toFixed(1)}%`)
  if (data.currentRatio !== null) parts.push(`Current Ratio: ${data.currentRatio.toFixed(2)}`)
  if (data.marketCap !== null) parts.push(`Market Cap: $${(data.marketCap / 1e9).toFixed(2)}B`)
  if (data.dividendYield !== null) parts.push(`Dividend Yield: ${(data.dividendYield * 100).toFixed(2)}%`)
  return parts.join(" | ")
}

function formatOpponentArguments(agentName: string, args: AgentArgument): string {
  const argsList = args.arguments.map((a, i) => `${i + 1}. ${a}`).join(" ")
  const evidenceList = args.evidence.map((e, i) => `${i + 1}. ${e}`).join(" ")
  return `The ${agentName} argued: ${args.position} - ${argsList}. Evidence: ${evidenceList}`
}

function failedAgentArgument(agentId: string, agentName: string): AgentArgument {
  return { agentId, agentName, position: "NEUTRAL", arguments: ["Agent failed to produce output for this round"], evidence: [], confidence: 0 }
}

function countFilledFundamentals(data: FundamentalData): string {
  const fields: Array<[string, unknown]> = [
    ["PE", data.peRatio], ["PB", data.pbRatio], ["EPS", data.eps],
    ["RevGrowth", data.revenueGrowth], ["ProfitMargin", data.profitMargin],
    ["D/E", data.debtToEquity], ["ROE", data.roe],
    ["CurrentRatio", data.currentRatio], ["MarketCap", data.marketCap],
    ["DivYield", data.dividendYield],
  ]
  const filled = fields.filter(([, v]) => v !== null)
  const missing = fields.filter(([, v]) => v === null).map(([k]) => k)
  let result = `${filled.length}/${fields.length} fields`
  if (missing.length > 0) result += ` (missing: ${missing.join(", ")})`
  return result
}

// ---- LangGraph State ----

const DebateAnnotation = Annotation.Root({
  ticker: Annotation<string>,
  currentPrice: Annotation<number>,
  priceBars: Annotation<PriceBar[]>,
  news: Annotation<NewsArticle[]>,
  fundamentals: Annotation<FundamentalData>,
  fundamentalsSummary: Annotation<string>,

  thesis: Annotation<Thesis | null>,

  // Analyst layer
  analystReports: Annotation<AgentArgument[]>,
  currentRound: Annotation<number>,
  maxRounds: Annotation<number>,
  debateComplete: Annotation<boolean>,
  prevBullArgs: Annotation<AgentArgument | null>,
  prevBearArgs: Annotation<AgentArgument | null>,

  // Research layer
  researchMemo: Annotation<ResearchMemo | null>,

  // Decision layer
  tradeProposal: Annotation<TradeProposal | null>,
  approvalDecision: Annotation<ApprovalDecision | null>,
  executionResult: Annotation<ExecutionSimResult | null>,
  alerts: Annotation<string | null>,

  // Data layer
  macroData: Annotation<MacroData | null>,

  // Control layer
  riskAssessment: Annotation<RiskAssessment | null>,
  judgment: Annotation<FinalJudgment | null>,
  quantRiskMetrics: Annotation<RiskMetrics | null>,
  dataQuality: Annotation<DataQuality>,
  verifierReport: Annotation<EvidenceGateOutput | null>,

  totalTokensUsed: Annotation<number>,
  error: Annotation<string | null>,

  hasPortfolio: Annotation<boolean>,
  portfolioTotalValue: Annotation<number>,
  portfolioHoldings: Annotation<Array<{ ticker: string; shares: number; averageCost: number; currentPrice?: number }>>,
  portfolioCashRatio: Annotation<number>,
})

type DebateState = typeof DebateAnnotation.State

// ---- Graph Factory ----

export function buildDebateGraph(
  llm: ILLMAdapter,
  newsAdapter: INewsAdapter,
  fundamentalAdapter: IFundamentalAdapter,
  marketData: IMarketDataAdapter,
  onProgress?: (event: ProgressEvent) => void,
) {
  const emit = (event: ProgressEvent) => { onProgress?.({ ...event, timestamp: Date.now() }) }

  // === NODE: fetchData ===
  async function fetchDataNode(state: DebateState): Promise<Partial<DebateState>> {
    const t0 = Date.now()
    emit({ phase: "data", detail: "Fetching market data...", node: "fetchData", status: "running" })
    let newsError = ""; let fundamentalsError = ""
    const [quote, priceBars, news, fundamentals, macroSpy, macroQqq, macroVix, macroTnx, macroDxy, macroOil] = await Promise.all([
      marketData.getQuote(state.ticker),
      marketData.getHistoricalPrices(state.ticker, "1d", "1y").catch((e) => { console.error(e); return [] as PriceBar[] }),
      newsAdapter.getNews(state.ticker, 10).catch((e) => { newsError = String(e instanceof Error ? e.message : e); console.error(e); return [] as NewsArticle[] }),
      fundamentalAdapter.getFundamentalData(state.ticker).catch((e) => { fundamentalsError = String(e instanceof Error ? e.message : e); console.error(e); return null }),
      marketData.getQuote("SPY").catch(() => null),
      marketData.getQuote("QQQ").catch(() => null),
      marketData.getQuote("^VIX").catch(() => null),
      marketData.getQuote("^TNX").catch(() => null),
      marketData.getQuote("DX-Y.NYB").catch(() => null),
      marketData.getQuote("CL=F").catch(() => null),
    ])
    const fundamentalsData = fundamentals ?? { ...DEFAULT_FUNDAMENTALS, ticker: state.ticker }
    const fundamentalsSummary = fundamentals ? buildFundamentalsSummary(fundamentalsData) : ""
    const missingFields: string[] = []
    const check = (k: string, v: unknown) => { if (v === null) missingFields.push(k) }
    check("PE", fundamentalsData.peRatio); check("PB", fundamentalsData.pbRatio); check("EPS", fundamentalsData.eps)
    check("ROE", fundamentalsData.roe); check("RevGrowth", fundamentalsData.revenueGrowth)
    const staleFlags: string[] = []
    if (priceBars.length < 60) staleFlags.push("short_history")
    if (!fundamentals) staleFlags.push("fundamentals_unavailable")
    let qualityScore = 100
    if (news.length === 0) qualityScore -= 30; else if (news.length < 3) qualityScore -= 15
    if (missingFields.length >= 5) qualityScore -= 30; else if (missingFields.length >= 3) qualityScore -= 15
    if (priceBars.length < 60) qualityScore -= 20
    if (!fundamentals) qualityScore -= 25
    if (qualityScore < 0) qualityScore = 0
    const dataQuality: DataQuality = { newsCount: news.length, missingFundamentalFields: missingFields, staleFlags, qualityScore }
    const macroData: MacroData = {
      spyChange: macroSpy?.changePercent ?? 0,
      qqqChange: macroQqq?.changePercent ?? 0,
      vixLevel: macroVix?.currentPrice ?? 0,
      us10y: macroTnx?.currentPrice ?? 0,
      dxy: macroDxy?.currentPrice ?? 0,
      oil: macroOil?.currentPrice ?? 0,
      marketRegime: (macroVix?.currentPrice ?? 20) > 25 ? "RISK_OFF" : (macroVix?.currentPrice ?? 20) < 15 && (macroSpy?.changePercent ?? 0) > 0 ? "RISK_ON" : "NEUTRAL",
      sectorRotation: (macroQqq?.changePercent ?? 0) > (macroSpy?.changePercent ?? 0) ? "Growth/Tech leading" : "Value/Cyclical leading",
    }
    const macroOk = macroVix ? `VIX=${macroData.vixLevel}, SPY=${macroData.spyChange.toFixed(1)}%` : "⚠ no macro"

    const parts: string[] = []
    parts.push(`Price: $${quote.currentPrice.toFixed(2)} | History: ${priceBars.length} bars`)
    parts.push(`News: ${news.length}/10 articles` + (newsError ? ` ⚠ ${newsError}` : ""))
    parts.push(`Fundamentals: ${fundamentals ? countFilledFundamentals(fundamentalsData) : "⚠ FAILED"}`)
    parts.push(`Macro: ${macroOk}`)
    parts.push(`Quality Score: ${qualityScore}/100${staleFlags.length > 0 ? ` (${staleFlags.join(", ")})` : ""}`)
    emit({ phase: "data", detail: parts.join("\n"), node: "fetchData", status: "done", durationMs: Date.now() - t0 })
    return { ticker: state.ticker, currentPrice: quote.currentPrice, priceBars, news, fundamentals: fundamentalsData, fundamentalsSummary, dataQuality, macroData }
  }

  // === NODE: formThesis ===
  async function formThesisNode(state: DebateState): Promise<Partial<DebateState>> {
    const t0 = Date.now()
    emit({ phase: "thesis", detail: "Forming thesis...", node: "formThesis", status: "running" })
    const result = await runMainThesis(llm, { ticker: state.ticker, currentPrice: state.currentPrice, fundamentalsSummary: state.fundamentalsSummary || undefined })
    if (!result.success || !result.data) return { error: `Thesis failed: ${result.error}`, totalTokensUsed: state.totalTokensUsed + result.tokensUsed }
    emit({ phase: "thesis", detail: result.data.thesis, node: "formThesis", status: "done", durationMs: Date.now() - t0 })
    return { thesis: result.data, totalTokensUsed: state.totalTokensUsed + result.tokensUsed, error: null }
  }

  // === NODE: analystPass ===
  async function analystPassNode(state: DebateState): Promise<Partial<DebateState>> {
    if (!state.thesis) return { error: "No thesis" }
    emit({ phase: "round", detail: "Analyst pass — News, Fundamental, Technical...", node: "analystPass", status: "running" })
    const t0 = Date.now()

    const result = await runAnalystPass(llm, {
      ticker: state.ticker,
      thesis: state.thesis,
      news: state.news,
      fundamentals: state.fundamentals,
      priceBars: state.priceBars,
      macroData: state.macroData ?? null,
    }).catch(() => null)

    let tokens = state.totalTokensUsed
    const reports: AgentArgument[] = []

    if (result && result.success && result.data) {
      tokens += result.tokensUsed ?? 0
      const d = result.data
      reports.push(
        { agentId: "news-agent", agentName: "新聞分析代理人", position: d.news.position, arguments: d.news.arguments, evidence: d.news.evidence, confidence: d.news.confidence },
        { agentId: "fundamental-agent", agentName: "基本面分析代理人", position: d.fundamental.position, arguments: d.fundamental.arguments, evidence: d.fundamental.evidence, confidence: d.fundamental.confidence },
        { agentId: "technical-agent", agentName: "技術分析代理人", position: d.technical.position, arguments: d.technical.arguments, evidence: d.technical.evidence, confidence: d.technical.confidence },
        { agentId: "sentiment-agent", agentName: "社群情緒分析代理人", position: d.sentiment.position, arguments: d.sentiment.arguments, evidence: d.sentiment.evidence, confidence: d.sentiment.confidence },
        { agentId: "macro-agent", agentName: "宏觀分析代理人", position: d.macro.position, arguments: d.macro.arguments, evidence: d.macro.evidence, confidence: d.macro.confidence },
      )
    } else {
      reports.push(
        failedAgentArgument("news-agent", "News Agent"),
        failedAgentArgument("fundamental-agent", "Fundamental Agent"),
        failedAgentArgument("technical-agent", "Technical Agent"),
        failedAgentArgument("sentiment-agent", "Sentiment Agent"),
        failedAgentArgument("macro-agent", "Macro Agent"),
      )
    }

    const names = reports.map((r) => `${r.agentName}: ${r.position} (${(r.confidence * 100).toFixed(0)}%)`).join(" | ")
    emit({ phase: "round", detail: `Analyst Reports: ${names}`, node: "analystPass", status: "done", durationMs: Date.now() - t0 })
    return { analystReports: reports, totalTokensUsed: tokens }
  }

  // === NODE: bullBearDebate ===
  async function bullBearDebateNode(state: DebateState): Promise<Partial<DebateState>> {
    if (!state.thesis) return { error: "No thesis" }
    const round = (state.currentRound ?? 0) + 1
    emit({ phase: "round", detail: `Bull/Bear Debate Round ${round}...`, node: "bullBearDebate", status: "running", round })

    const oppForBull = round > 1 && state.prevBearArgs ? formatOpponentArguments("Bear Researcher", state.prevBearArgs) : undefined
    const oppForBear = round > 1 && state.prevBullArgs ? formatOpponentArguments("Bull Researcher", state.prevBullArgs) : undefined

    const [bullResult, bearResult] = await Promise.all([
      runBullResearcher(llm, { ticker: state.ticker, thesis: state.thesis, analystReports: state.analystReports, opponentArguments: oppForBull, round }).catch(() => null),
      runBearResearcher(llm, { ticker: state.ticker, thesis: state.thesis, analystReports: state.analystReports, opponentArguments: oppForBear, round }).catch(() => null),
    ])

    let tokens = state.totalTokensUsed
    let bullArg: AgentArgument; let bearArg: AgentArgument
    let prevBull: AgentArgument | null = null; let prevBear: AgentArgument | null = null

    if (bullResult && typeof bullResult === "object" && "success" in bullResult && (bullResult as { success: boolean }).success && (bullResult as { data: unknown }).data) {
      tokens += (bullResult as { tokensUsed: number }).tokensUsed
      const d = (bullResult as { data: AgentArgument }).data
      bullArg = d; prevBull = d
    } else { bullArg = failedAgentArgument("bull-researcher", "Bull Researcher") }
    if (bearResult && typeof bearResult === "object" && "success" in bearResult && (bearResult as { success: boolean }).success && (bearResult as { data: unknown }).data) {
      tokens += (bearResult as { tokensUsed: number }).tokensUsed
      const d = (bearResult as { data: AgentArgument }).data
      bearArg = d; prevBear = d
    } else { bearArg = failedAgentArgument("bear-researcher", "Bear Researcher") }

    const maxRounds = state.maxRounds ?? 2
    const debateComplete = round >= maxRounds

    const bullStatus = prevBull ? `${prevBull.agentName}: ${prevBull.position} (${(prevBull.confidence * 100).toFixed(0)}%)` : "Bull: FAILED"
    const bearStatus = prevBear ? `${prevBear.agentName}: ${prevBear.position} (${(prevBear.confidence * 100).toFixed(0)}%)` : "Bear: FAILED"
    emit({ phase: "round", detail: `R${round}: ${bullStatus} | ${bearStatus}`, node: "bullBearDebate", status: "done", round })

    return { currentRound: round, debateComplete, prevBullArgs: prevBull, prevBearArgs: prevBear, totalTokensUsed: tokens }
  }

  // === NODE: researchManager ===
  async function researchManagerNode(state: DebateState): Promise<Partial<DebateState>> {
    if (!state.thesis) return { error: "No thesis" }
    const t0 = Date.now()
    emit({ phase: "round", detail: "Research Manager synthesizing...", node: "researchManager", status: "running" })

    const bullArg = state.prevBullArgs
    const bearArg = state.prevBearArgs
    if (!bullArg || !bearArg) return { error: "Missing Bull/Bear debate results" }

    const result = await runResearchManager(llm, {
      ticker: state.ticker,
      thesis: state.thesis,
      bullCase: { arguments: bullArg.arguments, evidence: bullArg.evidence, keyThemes: [], score: Math.round(bullArg.confidence * 100), summary: bullArg.arguments.join(". ") },
      bearCase: { arguments: bearArg.arguments, evidence: bearArg.evidence, keyThemes: [], score: Math.round(bearArg.confidence * 100), summary: bearArg.arguments.join(". ") },
      verifierReport: state.verifierReport,
    }).catch(() => null)

    if (result && typeof result === "object" && "success" in result && (result as { success: boolean }).success && (result as { data: unknown }).data) {
      const memo = (result as { data: ResearchMemo }).data
      emit({ phase: "round", detail: `Research Memo: ${memo.direction} (conviction ${(memo.conviction * 100).toFixed(0)}%)`, node: "researchManager", status: "done", durationMs: Date.now() - t0 })
      return { researchMemo: memo, totalTokensUsed: state.totalTokensUsed + (result as { tokensUsed: number }).tokensUsed }
    }
    return { error: "Research Manager failed" }
  }

  // === NODE: verifierCheck ===
  async function verifierCheckNode(state: DebateState): Promise<Partial<DebateState>> {
    if (!state.thesis) return { verifierReport: null }
    const t0 = Date.now()
    emit({ phase: "round", detail: "Verifier checking...", node: "verifierCheck", status: "running" })

    const debateArgs: AgentArgument[] = [state.prevBullArgs, state.prevBearArgs].filter((a): a is AgentArgument => a !== null)
    const allRounds = [
      { round: 1, arguments: state.analystReports },
      ...(debateArgs.length > 0 ? [{ round: 2, arguments: debateArgs }] : []),
    ]

    const result = await runVerifierAgent(llm, {
      ticker: state.ticker, thesis: state.thesis,
      rounds: allRounds,
      dataQuality: state.dataQuality,
    }).catch(() => null)
    if (result && typeof result === "object" && "success" in result && (result as { success: boolean }).success && (result as { data: unknown }).data) {
      const vr = (result as { data: EvidenceGateOutput }).data
      const proceedMsg = vr.canProceedToFinal
        ? `canProceed=true`
        : `canProceed=false → ${vr.summary}`
      emit({ phase: "round", detail: `Verifier: coverage=${vr.evidenceCoverageScore}/100, c-counterEvidence=${vr.counterEvidenceCoverage}/100, ${proceedMsg}`, node: "verifierCheck", status: "done", durationMs: Date.now() - t0 })
      if (!vr.canProceedToFinal) {
        return { verifierReport: vr, error: `驗證代理人否決：${vr.summary} (coverage=${vr.evidenceCoverageScore}, counterEvidence=${vr.counterEvidenceCoverage})`, totalTokensUsed: state.totalTokensUsed + (result as { tokensUsed: number }).tokensUsed }
      }
      return { verifierReport: vr, totalTokensUsed: state.totalTokensUsed + (result as { tokensUsed: number }).tokensUsed }
    }
    return { verifierReport: { unsupportedClaims: [], temporalMismatches: [], metricMismatches: [], duplicatedEvidenceIds: [], evidenceCoverageScore: 30, counterEvidenceCoverage: 50, canProceedToFinal: false, summary: "Verifier failed" } }
  }

  // === NODE: computeRiskMetrics ===
  async function computeRiskMetricsNode(state: DebateState): Promise<Partial<DebateState>> {
    if (!state.hasPortfolio) return { quantRiskMetrics: null }
    const t0 = Date.now()
    emit({ phase: "risk", detail: "Computing risk metrics...", node: "computeRiskMetrics", status: "running" })
    const closes = extractCloses(state.priceBars)
    const riskMetrics = computeAllRiskMetrics(closes)
    const resolvedHoldings = state.portfolioHoldings.map((h) => {
      const p = h.currentPrice ?? state.currentPrice
      return { ticker: h.ticker, allocation: state.portfolioTotalValue > 0 ? (h.shares * p) / state.portfolioTotalValue : 0 }
    })
    const concentration = computeConcentrationRisk(resolvedHoldings)
    emit({ phase: "risk", detail: `VaR95=$${(riskMetrics.var95 * state.portfolioTotalValue).toFixed(0)}, Sharpe=${riskMetrics.sharpeRatio.toFixed(2)}, ConcScore=${concentration.overallConcentrationScore}`, node: "computeRiskMetrics", status: "done", durationMs: Date.now() - t0 })
    return { quantRiskMetrics: riskMetrics }
  }

  // === NODE: assessRisk ===
  async function riskAssessmentNode(state: DebateState): Promise<Partial<DebateState>> {
    if (!state.hasPortfolio || !state.thesis || !state.quantRiskMetrics) return { riskAssessment: null }
    const t0 = Date.now()
    emit({ phase: "risk", detail: "Risk agent assessing...", node: "assessRisk", status: "running" })
    const resolvedHoldings = state.portfolioHoldings.map((h) => {
      const p = h.currentPrice ?? state.currentPrice
      return { ticker: h.ticker, allocation: state.portfolioTotalValue > 0 ? (h.shares * p) / state.portfolioTotalValue : 0 }
    })
    const result = await runRiskAgent(llm, { ticker: state.ticker, thesis: state.thesis, portfolio: { totalValue: state.portfolioTotalValue, holdings: resolvedHoldings, cashRatio: state.portfolioCashRatio }, riskMetrics: state.quantRiskMetrics }).catch(() => null)
    if (result && typeof result === "object" && "success" in result && (result as { success: boolean }).success && (result as { data: unknown }).data) {
      const d = (result as { data: RiskAssessment }).data
      emit({ phase: "risk", detail: d.portfolioImpact, node: "assessRisk", status: "done", durationMs: Date.now() - t0 })
      return { riskAssessment: d, totalTokensUsed: state.totalTokensUsed + (result as { tokensUsed: number }).tokensUsed }
    }
    return { riskAssessment: null }
  }

  // === NODE: trader ===
  async function traderNode(state: DebateState): Promise<Partial<DebateState>> {
    if (!state.researchMemo || !state.thesis) {
      const fallback: TradeProposal = { ticker: state.ticker, side: "NONE", action: "OBSERVE", timeHorizon: "N/A", sizingRationale: "No research memo available — conservative fallback", expectedCatalysts: [], invalidationConditions: [], thesisId: state.ticker }
      return { tradeProposal: fallback }
    }
    const t0 = Date.now()
    emit({ phase: "judgment", detail: "Trader generating proposal...", node: "trader", status: "running" })
    const holdsTicker = state.hasPortfolio && state.portfolioHoldings.some((h) => h.ticker === state.ticker)
    const riskObj = state.riskAssessment ? { maxPositionSize: state.riskAssessment.maxPositionSize, riskScore: state.riskAssessment.riskScore, warnings: state.riskAssessment.warnings } : null
    const result = await runTrader(llm, { ticker: state.ticker, thesis: state.thesis, researchMemo: state.researchMemo, riskAssessment: riskObj, holdsThisTicker: holdsTicker }).catch(() => null)
    if (result && typeof result === "object" && "success" in result && (result as { success: boolean }).success && (result as { data: unknown }).data) {
      const proposal = (result as { data: TradeProposal }).data
      emit({ phase: "judgment", detail: `Trade Proposal: ${proposal.side} ${proposal.action}`, node: "trader", status: "done", durationMs: Date.now() - t0 })
      return { tradeProposal: proposal, totalTokensUsed: state.totalTokensUsed + (result as { tokensUsed: number }).tokensUsed }
    }
    // Trader failed — produce conservative fallback proposal
    const fallback: TradeProposal = {
      ticker: state.ticker, side: "NONE", action: "OBSERVE", timeHorizon: "N/A",
      sizingRationale: "Trader agent failed to produce valid output — conservative fallback",
      expectedCatalysts: [], invalidationConditions: [], thesisId: state.ticker,
    }
    emit({ phase: "judgment", detail: `Trade Proposal: FALLBACK → OBSERVE (trader failed)`, node: "trader", status: "done", durationMs: Date.now() - t0 })
    return { tradeProposal: fallback }
  }

  // === NODE: approve ===
  async function approveNode(state: DebateState): Promise<Partial<DebateState>> {
    if (!state.tradeProposal) return { error: "No trade proposal" }
    const proposal = state.tradeProposal
    const holdsTicker = state.hasPortfolio && state.portfolioHoldings.some((h) => h.ticker === state.ticker)

    // Map TradeProposal to FinalJudgment for enforcement
    const judgment: FinalJudgment = {
      ticker: proposal.ticker,
      action: proposal.action,
      conviction: state.researchMemo?.conviction ?? 0.5,
      rationale: proposal.sizingRationale,
      debateSummary: state.researchMemo?.summary ?? "",
      bullSummary: state.researchMemo?.bullCase ?? [],
      bearSummary: state.researchMemo?.bearCase ?? [],
      keyEvidenceIds: [],
      evidenceStrength: state.researchMemo?.conviction != null && state.researchMemo.conviction >= 0.7 ? "STRONG" : state.researchMemo?.conviction != null && state.researchMemo.conviction >= 0.4 ? "MODERATE" : "WEAK",
      disagreementLevel: "LOW",
      dataQualityWarning: [],
      entryPrice: proposal.entryBand?.lower,
      stopLoss: proposal.stopLoss,
      positionSizePercent: proposal.maxPositionSizePct,
      invalidationConditions: proposal.invalidationConditions,
      nextReviewTrigger: state.researchMemo?.nextReviewTrigger ?? "1 month",
    }

    const resolvedHoldings = state.hasPortfolio ? state.portfolioHoldings.map((h) => {
      const p = h.currentPrice ?? state.currentPrice
      return { ticker: h.ticker, allocation: state.portfolioTotalValue > 0 ? (h.shares * p) / state.portfolioTotalValue : 0 }
    }) : []
    const concentration = state.hasPortfolio ? computeConcentrationRisk(resolvedHoldings) : null

    const enforced = enforceDecisionPolicy({
      judgment, dataQuality: state.dataQuality, verifierReport: state.verifierReport,
      riskAssessment: state.riskAssessment, concentration, holdsTicker,
    })

    const rejected = enforced.action !== proposal.action || enforced.action === "OBSERVE" || enforced.action === "NO_ACTION"
    const resized = enforced.positionSizePercent !== undefined && proposal.maxPositionSizePct !== undefined && enforced.positionSizePercent < proposal.maxPositionSizePct

    const approval: ApprovalDecision = {
      action: rejected ? "REJECTED" : resized ? "RESIZED" : "APPROVED",
      approvedBy: "policy-engine",
      originalSize: proposal.maxPositionSizePct,
      adjustedSize: resized ? enforced.positionSizePercent : undefined,
      rejectionReasons: rejected ? enforced.dataQualityWarning.filter((w: string) => w.startsWith("enforce:")) : [],
      overrideReasons: [],
      approvedAt: new Date().toISOString(),
    }

    if (rejected || resized) {
      emit({ phase: "judgment", detail: `Policy Engine: ${approval.action} (${proposal.action} → ${enforced.action})`, node: "approve", status: "done" })
    } else {
      emit({ phase: "judgment", detail: `Policy Engine: APPROVED`, node: "approve", status: "done" })
    }

    // Generate alerts
    const alerts = generateAlerts({
      riskAssessment: state.riskAssessment,
      dataQuality: state.dataQuality,
      verifierReport: state.verifierReport,
      concentration,
      executionResult: state.executionResult,
      approvalDecision: approval,
    })

    return { approvalDecision: approval, judgment: enforced, alerts: alerts.length > 0 ? JSON.stringify(alerts) : null }
  }

  // === NODE: executionSim ===
  async function executionSimNode(state: DebateState): Promise<Partial<DebateState>> {
    if (!state.tradeProposal) return { executionResult: null }
    const t0 = Date.now()
    emit({ phase: "judgment", detail: "Running execution simulation...", node: "executionSim", status: "running" })
    const result = simulateExecution({
      proposal: { side: state.tradeProposal.side, entryBand: state.tradeProposal.entryBand, maxPositionSizePct: state.tradeProposal.maxPositionSizePct },
      currentPrice: state.currentPrice, priceBars: state.priceBars,
      portfolioTotalValue: state.hasPortfolio ? state.portfolioTotalValue : 10000,
    })
    emit({ phase: "judgment", detail: `Exec sim: fill=${result.fillPct}%, slippage=${result.slippageBps}bps, cost=$${result.totalExecutionCost}`, node: "executionSim", status: "done", durationMs: Date.now() - t0 })
    return { executionResult: result }
  }

  // === NODE: conservativeFinal ===
  async function conservativeFinalNode(state: DebateState): Promise<Partial<DebateState>> {
    const hasQualityIssue = state.dataQuality.qualityScore < 40
    const reason = state.error
      ? `流程中止：${state.error}`
      : hasQualityIssue
        ? `資料品質不足（品質分數 ${state.dataQuality.qualityScore}/100）`
        : `觸發保守模式（品質分數=${state.dataQuality.qualityScore}）`
    const judgment: FinalJudgment = {
      ticker: state.ticker, action: "OBSERVE", conviction: 0.1,
      rationale: `${reason}，不建議任何交易行動。`,
      debateSummary: hasQualityIssue ? "分析因資料品質不足而中止" : "分析流程提前中止",
      bullSummary: [], bearSummary: [],
      keyEvidenceIds: [], evidenceStrength: "WEAK", disagreementLevel: "LOW",
      dataQualityWarning: state.error ? [state.error] : [`quality_score=${state.dataQuality.qualityScore}`],
      invalidationConditions: [], nextReviewTrigger: "資料改善後重新評估",
    }
    emit({ phase: "judgment", detail: judgment.rationale, node: "conservativeFinal", status: "done" })
    return { judgment }
  }

  // --- Routers ---
  function afterThesisRouter(s: DebateState): string { return s.error ? "conservativeFinal" : "analystPass" }
  function afterAnalystRouter(s: DebateState): string { return s.error ? "conservativeFinal" : "bullBearDebate" }
  function afterBullBearRouter(s: DebateState): string {
    if (s.error) return "conservativeFinal"
    if (!s.debateComplete) return "bullBearDebate"
    return "researchManager"
  }
  function afterResearchRouter(s: DebateState): string { return s.error ? "conservativeFinal" : "verifierCheck" }
  function afterVerifierRouter(s: DebateState): string {
    if (s.error) return "conservativeFinal"
    if (s.dataQuality.qualityScore < 30) return "conservativeFinal"
    if (s.verifierReport?.canProceedToFinal === false) return "conservativeFinal"
    return s.hasPortfolio ? "computeRiskMetrics" : "trader"
  }
  function afterRiskRouter(s: DebateState): string { return s.error ? "conservativeFinal" : "assessRisk" }
  function afterAssessRouter(s: DebateState): string { return "trader" }
  function afterTraderRouter(s: DebateState): string { return s.error && !s.tradeProposal ? "conservativeFinal" : "approve" }

  // --- Build Graph ---
  const graph = new StateGraph(DebateAnnotation)
    .addNode("fetchData", fetchDataNode)
    .addNode("formThesis", formThesisNode)
    .addNode("analystPass", analystPassNode)
    .addNode("bullBearDebate", bullBearDebateNode)
    .addNode("researchManager", researchManagerNode)
    .addNode("verifierCheck", verifierCheckNode)
    .addNode("computeRiskMetrics", computeRiskMetricsNode)
    .addNode("assessRisk", riskAssessmentNode)
    .addNode("trader", traderNode)
    .addNode("approve", approveNode)
    .addNode("executionSim", executionSimNode)
    .addNode("conservativeFinal", conservativeFinalNode)

    .addEdge(START, "fetchData")
    .addEdge("fetchData", "formThesis")
    .addConditionalEdges("formThesis", afterThesisRouter, { analystPass: "analystPass", conservativeFinal: "conservativeFinal" })
    .addConditionalEdges("analystPass", afterAnalystRouter, { bullBearDebate: "bullBearDebate", conservativeFinal: "conservativeFinal" })
    .addConditionalEdges("bullBearDebate", afterBullBearRouter, { bullBearDebate: "bullBearDebate", researchManager: "researchManager", conservativeFinal: "conservativeFinal" })
    .addConditionalEdges("researchManager", afterResearchRouter, { verifierCheck: "verifierCheck", conservativeFinal: "conservativeFinal" })
    .addConditionalEdges("verifierCheck", afterVerifierRouter, { computeRiskMetrics: "computeRiskMetrics", trader: "trader", conservativeFinal: "conservativeFinal" })
    .addConditionalEdges("computeRiskMetrics", afterRiskRouter, { assessRisk: "assessRisk", conservativeFinal: "conservativeFinal" })
    .addConditionalEdges("assessRisk", afterAssessRouter, { trader: "trader" })
    .addConditionalEdges("trader", afterTraderRouter, { approve: "approve", conservativeFinal: "conservativeFinal" })
    .addEdge("approve", "executionSim")
    .addEdge("executionSim", END)
    .addEdge("conservativeFinal", END)

  return graph.compile()
}

// ---- Convenience Runner ----

export async function runDebate(
  llm: ILLMAdapter, newsAdapter: INewsAdapter, fundamentalAdapter: IFundamentalAdapter, marketData: IMarketDataAdapter,
  ticker: string,
  options?: {
    portfolio?: { totalValue: number; holdings: Array<{ ticker: string; shares: number; averageCost: number; currentPrice?: number }>; cashRatio?: number }
    maxDebateRounds?: number
    onProgress?: (event: ProgressEvent) => void
  },
): Promise<DebateResult> {
  const startTime = Date.now()
  const graph = buildDebateGraph(llm, newsAdapter, fundamentalAdapter, marketData, options?.onProgress)

  const initialState: Partial<DebateState> = {
    ticker,
    currentPrice: 0, priceBars: [], news: [], fundamentals: DEFAULT_FUNDAMENTALS, fundamentalsSummary: "",
    thesis: null,
    analystReports: [], currentRound: 0, maxRounds: options?.maxDebateRounds ?? 2, debateComplete: false,
    prevBullArgs: null, prevBearArgs: null,
    researchMemo: null, tradeProposal: null,     approvalDecision: null, executionResult: null, alerts: null,
    macroData: null,
    riskAssessment: null, judgment: null, quantRiskMetrics: null,
    dataQuality: { newsCount: 0, missingFundamentalFields: [], staleFlags: [], qualityScore: 0 },
    verifierReport: null, totalTokensUsed: 0, error: null,
    hasPortfolio: !!options?.portfolio, portfolioTotalValue: options?.portfolio?.totalValue ?? 0,
    portfolioHoldings: options?.portfolio?.holdings ?? [], portfolioCashRatio: options?.portfolio?.cashRatio ?? 0.2,
  }

  const finalState = await graph.invoke(initialState) as DebateState
  if (finalState.error) throw new Error(finalState.error)
  if (!finalState.judgment) throw new Error("Debate did not produce a complete result")

  // Save run history (fire-and-forget)
  saveRunHistory({
    ticker, thesis: JSON.stringify(finalState.thesis),
    researchMemo: finalState.researchMemo ? JSON.stringify(finalState.researchMemo) : undefined,
    tradeProposal: finalState.tradeProposal ? JSON.stringify(finalState.tradeProposal) : undefined,
    approvalDecision: finalState.approvalDecision ? JSON.stringify(finalState.approvalDecision) : undefined,
    executionResult: finalState.executionResult ? JSON.stringify(finalState.executionResult) : undefined,
    alerts: finalState.alerts ?? undefined,
    totalTokens: finalState.totalTokensUsed, durationMs: Date.now() - startTime,
  }).catch(() => {})

  return {
    ticker: finalState.ticker, currentPrice: finalState.currentPrice,
    thesis: finalState.thesis!, rounds: [{ round: 1, thesis: finalState.thesis!, arguments: finalState.analystReports }],
    riskAssessment: finalState.riskAssessment, judgment: finalState.judgment,
    researchMemo: finalState.researchMemo ?? undefined,
    tradeProposal: finalState.tradeProposal ?? undefined,
    approvalDecision: finalState.approvalDecision ?? undefined,
    totalTokensUsed: finalState.totalTokensUsed, durationMs: Date.now() - startTime,
  }
}
