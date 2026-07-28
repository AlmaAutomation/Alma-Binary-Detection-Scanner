/**
 * Pure helpers for Compatibility Knowledge profile presentation.
 */
import { formatConfidence } from "./graphModel";

export function classifyKnowledgeError(err) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  if (status === 404) {
    return {
      kind: "not_found",
      message: typeof detail === "string" ? detail : "No knowledge profile for this fingerprint.",
      errors: [],
    };
  }
  if (status === 422) {
    const message =
      typeof detail === "object" && detail?.message
        ? detail.message
        : "Malformed evidence prevented knowledge aggregation.";
    const errors = typeof detail === "object" ? detail?.errors || [] : [];
    return { kind: "malformed", message, errors };
  }
  return {
    kind: "error",
    message: err?.message || "Knowledge request failed.",
    errors: [],
  };
}

function mapEvidenceRows(items, labelKey, extra = () => ({})) {
  return (items || []).map((item) => ({
    key: item[labelKey] || item.contract || item.runtime || item.strategy,
    label: item[labelKey] || item.contract || item.runtime || item.strategy,
    provenance: item.evidence_references || [],
    ...extra(item),
  }));
}

/** Build a read-only knowledge view for Explorer detail panels. */
export function buildKnowledgeView(profile) {
  if (!profile) return null;

  const frameworks = mapEvidenceRows(profile.observed_frameworks, "framework", (item) => ({
    observationCount: item.observation_count,
    verifiedSessionCount: item.verified_session_count,
    confidence: item.confidence,
    classification: item.classification,
  }));

  const strategies = mapEvidenceRows(profile.observed_launch_strategies, "strategy", (item) => ({
    attempts: item.attempts,
    verifiedSuccesses: item.verified_successes,
    verifiedFailures: item.verified_failures,
    successRate: item.success_rate,
  }));

  const contracts = mapEvidenceRows(profile.verification_contracts, "contract", (item) => ({
    passedCount: item.passed_count,
    failedCount: item.failed_count,
  }));

  const runtimes = mapEvidenceRows(profile.observed_runtimes, "runtime", (item) => ({
    observationCount: item.observation_count,
    verifiedSuccessObservationCount: item.verified_success_observation_count,
  }));

  const conflicts = (profile.conflicts || []).map((conflict) => ({
    relationship: conflict.relationship,
    conflictType: conflict.conflict_type,
    competing: conflict.competing_observations || [],
    evidenceBySide: conflict.evidence_by_side || {},
    message: `Competing ${conflict.relationship} observations: ${(conflict.competing_observations || []).join(", ")}`,
  }));

  return {
    applicationFingerprint: profile.application_fingerprint,
    applicationName: profile.application_name,
    schemaVersion: profile.schema_version,
    generatedAt: profile.generated_at,
    sessionStats: {
      total: profile.total_sessions,
      verifiedSuccesses: profile.verified_successes,
      verifiedFailures: profile.verified_failures,
      unverifiable: profile.unverifiable_sessions,
    },
    frameworks,
    strategies,
    contracts,
    runtimes,
    conflicts,
    formatConfidence,
  };
}

/** True when profile text avoids authoritative requirement language. */
export function knowledgeViewAvoidsRequiredLanguage(view) {
  const serialized = JSON.stringify(view || {});
  const banned = ["required", "best strategy", "confirmed_required", "runtime_required"];
  const lower = serialized.toLowerCase();
  return !banned.some((term) => lower.includes(term));
}

/** Conflicts list all sides without declaring a winner. */
export function conflictsPreserveAllSides(view) {
  return (view?.conflicts || []).every((conflict) => {
    const sides = conflict.competing || [];
    if (sides.length < 2) return true;
    return sides.every((side) => (conflict.evidenceBySide[side] || []).length > 0);
  });
}

/** Every aggregate row links to underlying evidence. */
export function allAggregatesHaveProvenance(view) {
  const sections = [
    ...(view?.frameworks || []),
    ...(view?.strategies || []),
    ...(view?.contracts || []),
    ...(view?.runtimes || []),
  ];
  return sections.every((row) => row.provenance?.length > 0);
}
