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
  let positionSizePercent = judgment.positionSizePercent
  const warnings = [...judgment.dataQualityWarning]
  let downgraded = action !== judgment.action

  // Rule 0: Non-holder outputting HOLD/REDUCE/EXIT → force OBSERVE
  if (!holdsTicker && ["HOLD", "REDUCE", "EXIT"].includes(judgment.action)) {
    action = "OBSERVE"
    conviction = Math.min(conviction, 0.3)
    warnings.push(`enforce: action_requires_holding (${judgment.action}→OBSERVE, holdsTicker=false)`)
    downgraded = true
  }

  // NEW Rule 0b: Holder receiving OBSERVE → force HOLD (holders should manage, not "observe")
  if (!downgraded && holdsTicker && judgment.action === "OBSERVE") {
    action = "HOLD"
    conviction = Math.min(conviction, 0.5)
    warnings.push("enforce: holder_should_not_observe (OBSERVE→HOLD, holdsTicker=true)")
    downgraded = true
  }

  // Rule 1: qualityScore < 40 → force OBSERVE (hardest rule, no exceptions)
  if (!downgraded && dataQuality.qualityScore < 40) {
    action = "OBSERVE"
    conviction = Math.min(conviction, 0.15)
    warnings.push(`enforce: data_quality_too_low (score=${dataQuality.qualityScore})`)
    downgraded = true
  }

  // Rule 2: Verifier blocked → force OBSERVE
  if (!downgraded && verifierReport?.canProceedToFinal === false) {
    action = "OBSERVE"
    conviction = Math.min(conviction, 0.15)
    warnings.push(`enforce: verifier_blocked (coverage=${verifierReport.evidenceCoverageScore})`)
    downgraded = true
  }

  // Rule 3: evidenceCoverage < 25 → force OBSERVE; < 40 → cap size instead of ban
  if (!downgraded && verifierReport) {
    if (verifierReport.evidenceCoverageScore < 25) {
      action = "OBSERVE"
      conviction = Math.min(conviction, 0.2)
      warnings.push(`enforce: evidence_coverage_too_low (coverage=${verifierReport.evidenceCoverageScore})`)
      downgraded = true
    } else if (verifierReport.evidenceCoverageScore < 40 && action === "ADD_SMALL") {
      const cap = 2
      if (positionSizePercent === undefined || positionSizePercent > cap) {
        positionSizePercent = cap
        warnings.push(`enforce: low_coverage_capped_to_${cap}pct (coverage=${verifierReport.evidenceCoverageScore})`)
      }
    }
  }

  // Rule 4: evidenceStrength WEAK + ADD_SMALL → cap 2% instead of ban
  if (!downgraded && judgment.evidenceStrength === "WEAK" && action === "ADD_SMALL") {
    const cap = 2
    if (positionSizePercent === undefined || positionSizePercent > cap) {
      positionSizePercent = cap
      warnings.push(`enforce: weak_evidence_capped_to_${cap}pct`)
    }
  }

  // Rule 5: riskScore thresholds — graduated
  if (!downgraded && riskAssessment && action === "ADD_SMALL") {
    if (riskAssessment.riskScore >= 75) {
      action = "HOLD"
      conviction = conviction * 0.5
      warnings.push(`enforce: high_risk_blocks_add_small (riskScore=${riskAssessment.riskScore})`)
      downgraded = true
    } else if (riskAssessment.riskScore >= 60) {
      const cap = 3
      if (positionSizePercent === undefined || positionSizePercent > cap) {
        positionSizePercent = cap
        warnings.push(`enforce: elevated_risk_capped_to_${cap}pct (riskScore=${riskAssessment.riskScore})`)
      }
    }
  }

  // Rule 6: concentration score < 50 + ADD_SMALL → HOLD
  if (!downgraded && concentration && concentration.overallConcentrationScore < 50 && action === "ADD_SMALL") {
    action = "HOLD"
    conviction = conviction * 0.6
    warnings.push(`enforce: high_concentration_blocks_add_small (concScore=${concentration.overallConcentrationScore})`)
    downgraded = true
  }

  // Rule 7: disagreement HIGH + ADD_SMALL → cap 2% instead of ban
  if (!downgraded && judgment.disagreementLevel === "HIGH" && action === "ADD_SMALL") {
    const cap = 2
    if (positionSizePercent === undefined || positionSizePercent > cap) {
      positionSizePercent = cap
      warnings.push(`enforce: high_disagreement_capped_to_${cap}pct`)
    }
  }

  // Rule 8: singleStockRisk.isConcentrated → cap position size at 5%
  if (concentration?.singleStockRisk?.isConcentrated && positionSizePercent !== undefined) {
    const capped = Math.min(positionSizePercent, 5)
    if (capped < positionSizePercent) {
      positionSizePercent = capped
      warnings.push(`enforce: concentrated_portfolio_caps_position_at_5pct (was ${judgment.positionSizePercent}%)`)
    }
  }

  // Rule 9: disagreement HIGH + REDUCE (not ADD_SMALL) → downgrade to HOLD
  if (!downgraded && judgment.disagreementLevel === "HIGH" && action === "REDUCE") {
    action = "HOLD"
    conviction = conviction * 0.6
    warnings.push("enforce: high_disagreement_downgrades_reduce_to_hold")
    downgraded = true
  }

  // Rule 10: riskScore > 85 → force OBSERVE regardless
  if (!downgraded && riskAssessment && riskAssessment.riskScore > 85) {
    action = "OBSERVE"
    conviction = Math.min(conviction, 0.1)
    warnings.push(`enforce: extreme_risk_forces_observe (riskScore=${riskAssessment.riskScore})`)
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
