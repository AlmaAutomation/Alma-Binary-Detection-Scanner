/**
 * Pure helpers for Compatibility Advisor presentation.
 */
import { formatConfidence } from "./graphModel";

export function classifyAdvisorError(err) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  if (status === 404) {
    return {
      kind: "not_found",
      message: typeof detail === "string" ? detail : "No advisor explanation for this query.",
      errors: [],
    };
  }
  if (status === 422) {
    const message =
      typeof detail === "object" && detail?.message
        ? detail.message
        : "Malformed evidence prevented advisor explanation.";
    const errors = typeof detail === "object" ? detail?.errors || [] : [];
    return { kind: "malformed", message, errors };
  }
  return {
    kind: "error",
    message: err?.message || "Advisor request failed.",
    errors: [],
  };
}

const CATEGORY_LABELS = {
  verified_outcome_history: "Verified outcome history",
  framework_observation: "Framework observations",
  strategy_history: "Launch strategy history",
  runtime_observation: "Observed runtimes",
  verification_contract: "Verification contracts",
  compatibility_change: "Compatibility changes",
  conflicting_evidence: "Conflicting evidence",
  insufficient_evidence: "Insufficient evidence",
};

const SEVERITY_TONES = {
  critical: "critical",
  warning: "warning",
  info: "info",
  notice: "info",
};

function mapObservation(observation) {
  return {
    id: observation.observation_id,
    category: observation.category,
    categoryLabel: CATEGORY_LABELS[observation.category] || observation.category,
    title: observation.title,
    statement: observation.statement,
    confidence: observation.confidence,
    severity: observation.severity,
    severityTone: SEVERITY_TONES[observation.severity] || "info",
    sourceLayer: observation.source_layer,
    provenance: observation.evidence_references || [],
  };
}

/** Build a read-only advisor view for Explorer detail panels. */
export function buildAdvisorView(explanation) {
  if (!explanation) return null;

  const observations = (explanation.observations || []).map(mapObservation);
  const grouped = observations.reduce((acc, item) => {
    const key = item.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return {
    applicationFingerprint: explanation.application_fingerprint,
    applicationName: explanation.application_name,
    schemaVersion: explanation.schema_version,
    engineVersion: explanation.engine_version,
    generatedAt: explanation.generated_at,
    summary: explanation.summary || "",
    limitations: explanation.limitations || [],
    observations,
    groupedObservations: grouped,
    renderMode: explanation.render_mode || "deterministic",
    fallbackReason: explanation.fallback_reason || null,
    renderStatusLabel: advisorRenderStatusLabel(explanation),
    formatConfidence,
  };
}

/** Human-readable render status for Explorer. */
export function advisorRenderStatusLabel(explanation) {
  const mode = explanation?.render_mode || "deterministic";
  if (mode === "llm") {
    return "AI-rendered from verified Alma evidence";
  }
  if (mode === "deterministic_fallback") {
    return "AI unavailable — deterministic explanation shown";
  }
  return "Deterministic";
}

/** True when advisor view avoids prescriptive or broken-language copy. */
export function advisorViewAvoidsPrescriptiveLanguage(view) {
  const serialized = JSON.stringify(view || {}).toLowerCase();
  const banned = [
    "best strategy",
    "requires vc++",
    "install vc++",
    "application is broken",
    "you should",
    "alma recommends",
    "switch to",
    "fix by",
    "runtime_required",
    "confirmed_required",
  ];
  return !banned.some((phrase) => serialized.includes(phrase));
}

/** True when every observation exposes provenance. */
export function allObservationsHaveProvenance(view) {
  return (view?.observations || []).every((obs) => obs.provenance?.length > 0);
}
