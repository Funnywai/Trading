import { FinalJudgment, DataQuality, EvidenceGateOutput, RiskAssessment } from "@/types"
import { ConcentrationReport } from "./concentration"

export function enforceDecisionPolicy(params: {
  judgment: FinalJudgment
  dataQuality: DataQuality
  verifierReport: EvidenceGateOutput | null
  riskAssessment: RiskAssessment | null
  concentration: ConcentrationReport | null
  holdsTicker?: boolean
}): FinalJudgment {
  const holdsTicker = params.holdsTicker ?? true
  const { judgment, dataQuality, verifierReport, riskAssessment, concentration } = params

  let action = judgment.action
  let conviction = judgment.conviction
  let positionSizePercent = judgment.positionSizePercent ?? undefined
  const warnings = [...judgment.dataQualityWarning]
  let downgraded = action !== judgment.action

  // Rule 0: Non-holder outputting HOLD/REDUCE/EXIT → force OBSERVE
  if (!holdsTicker && ["HOLD", "REDUCE", "EXIT"].includes(judgment.action)) {
    action = "OBSERVE"
    conviction = Math.min(conviction, 0.3)
    warnings.push(`enforce: 未持有此股票，${judgment.action} 不適用，已改為觀察`)
    downgraded = true
  }

  // NEW Rule 0b: Holder receiving OBSERVE → force HOLD (holders should manage, not "observe")
  if (!downgraded && holdsTicker && judgment.action === "OBSERVE") {
    action = "HOLD"
    conviction = Math.min(conviction, 0.5)
    warnings.push("enforce: 已持有此股票，不應僅觀察，已改為持有")
    downgraded = true
  }

  // Rule 1: qualityScore < 40 → force OBSERVE (hardest rule, no exceptions)
  if (!downgraded && dataQuality.qualityScore < 40) {
    action = "OBSERVE"
    conviction = Math.min(conviction, 0.15)
    warnings.push(`enforce: 資料品質不足（品質分數=${dataQuality.qualityScore}），強制觀察`)
    downgraded = true
  }

  // Rule 2: Verifier blocked → force OBSERVE
  if (!downgraded && verifierReport?.canProceedToFinal === false) {
    action = "OBSERVE"
    conviction = Math.min(conviction, 0.15)
    warnings.push(`enforce: 驗證代理人否決（證據覆蓋=${verifierReport.evidenceCoverageScore}），強制觀察`)
    downgraded = true
  }

  // Rule 3: evidenceCoverage < 25 → force OBSERVE; < 40 → cap size instead of ban
  if (!downgraded && verifierReport) {
    if (verifierReport.evidenceCoverageScore < 25) {
      action = "OBSERVE"
      conviction = Math.min(conviction, 0.2)
      warnings.push(`enforce: 證據覆蓋率過低（coverage=${verifierReport.evidenceCoverageScore}），強制觀察`)
      downgraded = true
    } else if (verifierReport.evidenceCoverageScore < 40 && action === "ADD_SMALL") {
      const cap = 2
      if (positionSizePercent === undefined || positionSizePercent > cap) {
        positionSizePercent = cap
        warnings.push(`enforce: 證據覆蓋率偏低（coverage=${verifierReport.evidenceCoverageScore}），倉位上限調至 ${cap}%`)
      }
    }
  }

  // Rule 4: evidenceStrength WEAK + ADD_SMALL → cap 2% instead of ban
  if (!downgraded && judgment.evidenceStrength === "WEAK" && action === "ADD_SMALL") {
    const cap = 2
    if (positionSizePercent === undefined || positionSizePercent > cap) {
      positionSizePercent = cap
      warnings.push(`enforce: 證據力不足，倉位上限調至 ${cap}%`)
    }
  }

  // Rule 5: riskScore thresholds — graduated
  if (!downgraded && riskAssessment && action === "ADD_SMALL") {
    if (riskAssessment.riskScore >= 75) {
      action = "HOLD"
      conviction = conviction * 0.5
      warnings.push(`enforce: 風險評分過高（riskScore=${riskAssessment.riskScore}），禁止增持`)
      downgraded = true
    } else if (riskAssessment.riskScore >= 60) {
      const cap = 3
      if (positionSizePercent === undefined || positionSizePercent > cap) {
        positionSizePercent = cap
        warnings.push(`enforce: 風險偏高（riskScore=${riskAssessment.riskScore}），倉位上限調至 ${cap}%`)
      }
    }
  }

  // Rule 6: concentration score < 50 + ADD_SMALL → HOLD (holder) / OBSERVE (non-holder)
  if (!downgraded && concentration && concentration.overallConcentrationScore < 50 && action === "ADD_SMALL") {
    if (holdsTicker) {
      action = "HOLD"
      conviction = conviction * 0.6
      warnings.push(`enforce: 組合集中度過高（concScore=${concentration.overallConcentrationScore}），禁止增持，改為持有`)
    } else {
      action = "OBSERVE"
      conviction = Math.min(conviction, 0.3)
      warnings.push(`enforce: 組合集中度過高（concScore=${concentration.overallConcentrationScore}），禁止開新倉位，改為觀察`)
    }
    downgraded = true
  }

  // Rule 7: disagreement HIGH + ADD_SMALL → cap 2% instead of ban
  if (!downgraded && judgment.disagreementLevel === "HIGH" && action === "ADD_SMALL") {
    const cap = 2
    if (positionSizePercent === undefined || positionSizePercent > cap) {
      positionSizePercent = cap
      warnings.push(`enforce: 代理人分歧過大，倉位上限調至 ${cap}%`)
    }
  }

  // Rule 8: singleStockRisk.isConcentrated → cap position size at 5%
  if (concentration?.singleStockRisk?.isConcentrated && positionSizePercent !== undefined) {
    const capped = Math.min(positionSizePercent, 5)
    if (capped < positionSizePercent) {
      positionSizePercent = capped
      warnings.push(`enforce: 單一持股過度集中，倉位上限調至 5%（原建議 ${judgment.positionSizePercent}%）`)
    }
  }

  // Rule 9: disagreement HIGH + REDUCE (not ADD_SMALL) → downgrade to HOLD
  if (!downgraded && judgment.disagreementLevel === "HIGH" && action === "REDUCE") {
    action = "HOLD"
    conviction = conviction * 0.6
    warnings.push("enforce: 代理人分歧過大，減持降級為持有")
    downgraded = true
  }

  // Rule 10: riskScore > 85 → force OBSERVE regardless
  if (!downgraded && riskAssessment && riskAssessment.riskScore > 85) {
    action = "OBSERVE"
    conviction = Math.min(conviction, 0.1)
    warnings.push(`enforce: 極端風險（riskScore=${riskAssessment.riskScore}），強制觀察`)
    downgraded = true
  }

  return {
    ...judgment,
    action,
    conviction,
    positionSizePercent,
    dataQualityWarning: warnings,
  }
}
