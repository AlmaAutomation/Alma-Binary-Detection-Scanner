/**
 * Pure helpers for Compatibility Regression report presentation.
 */
import { formatConfidence } from "./graphModel";

export function classifyRegressionError(err) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  if (status === 404) {
    return {
      kind: "not_found",
      message: typeof detail === "string" ? detail : "No regression report for this query.",
      errors: [],
    };
  }
  if (status === 422) {
    const message =
      typeof detail === "object" && detail?.message
        ? detail.message
        : "Malformed evidence prevented regression comparison.";
    const errors = typeof detail === "object" ? detail?.errors || [] : [];
    return { kind: "malformed", message, errors };
  }
  return {
    kind: "error",
    message: err?.message || "Regression request failed.",
    errors: [],
  };
}

const SEVERITY_TONES = {
  critical: "critical",
  warning: "warning",
  info: "info",
  notice: "info",
};

function mapFinding(finding) {
  return {
    id: finding.regression_id,
    type: finding.regression_type,
    severity: finding.severity,
    severityTone: SEVERITY_TONES[finding.severity] || "info",
    subject: finding.subject,
    summary: finding.summary,
    confidence: finding.confidence,
    comparisonSessionId: finding.comparison_session_id,
    baselineSessionIds: finding.baseline_session_ids || [],
    firstObservedAt: finding.first_observed_at,
    previousState: finding.previous_state,
    currentState: finding.current_state,
    provenance: finding.evidence_references || [],
  };
}

/** Build a read-only regression view for Explorer detail panels. */
export function buildRegressionView(report) {
  if (!report) return null;

  const findings = (report.findings || report.regressions || []).map(mapFinding);

  return {
    applicationFingerprint: report.application_fingerprint,
    applicationName: report.application_name,
    schemaVersion: report.schema_version,
    generatedAt: report.generated_at,
    comparisonSessionId: report.comparison_session_id,
    baselineSessionCount: report.baseline_session_count,
    currentSessionCount: report.current_session_count,
    unchangedSummary: report.unchanged_summary || "",
    findings,
    hasFindings: findings.length > 0,
    formatConfidence,
  };
}

/** True when regression view avoids prescriptive or broken-language copy. */
export function regressionViewAvoidsPrescriptiveLanguage(view) {
  const serialized = JSON.stringify(view || {}).toLowerCase();
  const banned = [
    "application is broken",
    "requires vc++",
    "best strategy",
    "you should reinstall",
    "alma recommends",
  ];
  return !banned.some((term) => serialized.includes(term));
}

/** Every finding links to before and after evidence. */
export function allFindingsHaveProvenance(view) {
  return (view?.findings || []).every(
    (finding) =>
      finding.previousState?.evidence_references?.length > 0 &&
      finding.currentState?.evidence_references?.length > 0 &&
      finding.provenance?.length > 0
  );
}

/** Regression summaries use factual change language for non-critical types. */
export function regressionSummariesUseFactualLanguage(view) {
  return (view?.findings || []).every((finding) => {
    const summary = (finding.summary || "").toLowerCase();
    if (finding.type === "strategy_success_rate_dropped") {
      return summary.includes("observed") && !summary.includes("broken");
    }
    if (finding.type === "framework_changed") {
      return summary.includes("framework evidence changed");
    }
    if (finding.type === "verification_contract_changed") {
      return summary.includes("verification contract changed");
    }
    if (finding.type === "runtime_observation_changed") {
      return summary.includes("runtime observation changed");
    }
    if (finding.type === "new_conflict") {
      return summary.includes("new conflicting evidence");
    }
    return true;
  });
}
