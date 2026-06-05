import { RiskAssessment, DataQuality, EvidenceGateOutput, ApprovalDecision, ExecutionSimResult } from "@/types"
import { ConcentrationReport } from "./concentration"

export interface Alert {
  id: string
  level: "INFO" | "WARNING" | "CRITICAL"
  category: "risk" | "data_quality" | "concentration" | "execution" | "thesis"
  message: string
  triggeredAt: string
}

let alertCounter = 0

export function generateAlerts(params: {
  riskAssessment?: RiskAssessment | null
  dataQuality: DataQuality
  verifierReport?: EvidenceGateOutput | null
  concentration?: ConcentrationReport | null
  executionResult?: ExecutionSimResult | null
  approvalDecision?: ApprovalDecision | null
}): Alert[] {
  const alerts: Alert[] = []
  const now = new Date().toISOString()
  const id = () => `ALT-${++alertCounter}-${Date.now().toString(36)}`

  // Risk alerts
  if (params.riskAssessment) {
    if (params.riskAssessment.riskScore > 85) {
      alerts.push({ id: id(), level: "CRITICAL", category: "risk", message: `極端風險：riskScore=${params.riskAssessment.riskScore}/100`, triggeredAt: now })
    } else if (params.riskAssessment.riskScore > 70) {
      alerts.push({ id: id(), level: "WARNING", category: "risk", message: `高風險：riskScore=${params.riskAssessment.riskScore}/100`, triggeredAt: now })
    } else if (params.riskAssessment.riskScore > 50) {
      alerts.push({ id: id(), level: "INFO", category: "risk", message: `中等風險：riskScore=${params.riskAssessment.riskScore}/100`, triggeredAt: now })
    }
  }

  // Data quality alerts
  if (params.dataQuality.qualityScore < 40) {
    alerts.push({ id: id(), level: "CRITICAL", category: "data_quality", message: `資料品質嚴重不足：qualityScore=${params.dataQuality.qualityScore}/100`, triggeredAt: now })
  } else if (params.dataQuality.qualityScore < 60) {
    alerts.push({ id: id(), level: "WARNING", category: "data_quality", message: `資料品質偏低：qualityScore=${params.dataQuality.qualityScore}/100`, triggeredAt: now })
  }
  if (params.dataQuality.newsCount < 3) {
    alerts.push({ id: id(), level: "WARNING", category: "data_quality", message: `新聞不足：${params.dataQuality.newsCount}篇`, triggeredAt: now })
  }
  if (params.dataQuality.missingFundamentalFields.length >= 3) {
    alerts.push({ id: id(), level: "INFO", category: "data_quality", message: `多個基本面欄位缺失：${params.dataQuality.missingFundamentalFields.join(", ")}`, triggeredAt: now })
  }

  // Verifier alerts
  if (params.verifierReport) {
    if (!params.verifierReport.canProceedToFinal) {
      alerts.push({ id: id(), level: "WARNING", category: "data_quality", message: `驗證代理人否決：coverage=${params.verifierReport.evidenceCoverageScore}/100`, triggeredAt: now })
    }
    if (params.verifierReport.unsupportedClaims.length > 0) {
      alerts.push({ id: id(), level: "INFO", category: "data_quality", message: `${params.verifierReport.unsupportedClaims.length}個無根據論點被標記`, triggeredAt: now })
    }
    if (params.verifierReport.counterEvidenceCoverage < 20) {
      alerts.push({ id: id(), level: "WARNING", category: "data_quality", message: `反方證據覆蓋不足：counterEvidenceCoverage=${params.verifierReport.counterEvidenceCoverage}/100`, triggeredAt: now })
    }
  }

  // Concentration alerts
  if (params.concentration) {
    if (params.concentration.singleStockRisk.isConcentrated) {
      alerts.push({ id: id(), level: "CRITICAL", category: "concentration", message: `單一持倉過度集中：${params.concentration.singleStockRisk.warning}`, triggeredAt: now })
    }
    if (params.concentration.overallConcentrationScore < 50) {
      alerts.push({ id: id(), level: "WARNING", category: "concentration", message: `整體集中度過高：concScore=${params.concentration.overallConcentrationScore}/100`, triggeredAt: now })
    }
    if (params.concentration.correlationClusterRisk === "HIGH") {
      alerts.push({ id: id(), level: "WARNING", category: "concentration", message: "行業集中度過高", triggeredAt: now })
    }
  }

  // Execution alerts
  if (params.executionResult) {
    if (params.executionResult.fillPct < 80) {
      alerts.push({ id: id(), level: "WARNING", category: "execution", message: `執行成交率低：fillPct=${params.executionResult.fillPct}%`, triggeredAt: now })
    }
    if (params.executionResult.slippageBps > 50) {
      alerts.push({ id: id(), level: "WARNING", category: "execution", message: `高滑價：${params.executionResult.slippageBps}bps`, triggeredAt: now })
    }
    if (params.executionResult.liquidityWarning) {
      alerts.push({ id: id(), level: "INFO", category: "execution", message: `流動性警告：${params.executionResult.liquidityWarning}`, triggeredAt: now })
    }
  }

  // Approval alerts
  if (params.approvalDecision) {
    if (params.approvalDecision.action === "REJECTED") {
      alerts.push({ id: id(), level: "INFO", category: "thesis", message: `交易提案被策略引擎拒絕：${params.approvalDecision.rejectionReasons.join("; ")}`, triggeredAt: now })
    } else if (params.approvalDecision.action === "RESIZED") {
      alerts.push({ id: id(), level: "INFO", category: "thesis", message: `倉位被調整：${params.approvalDecision.originalSize}% → ${params.approvalDecision.adjustedSize}%`, triggeredAt: now })
    }
  }

  return alerts
}
