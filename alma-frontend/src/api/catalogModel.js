/**
 * Pure helpers for Compatibility Catalog presentation.
 */

export function classifyCatalogError(err) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  if (status === 404) {
    return {
      kind: "not_found",
      message: typeof detail === "string" ? detail : "No applications in catalog.",
      errors: [],
    };
  }
  if (status === 422) {
    const message =
      typeof detail === "object" && detail?.message
        ? detail.message
        : "Malformed evidence prevented catalog aggregation.";
    const errors = typeof detail === "object" ? detail?.errors || [] : [];
    return { kind: "malformed", message, errors };
  }
  return {
    kind: "error",
    message: err?.message || "Catalog request failed.",
    errors: [],
  };
}

export function formatVerifiedHistory(entry) {
  const successes = entry?.verified_successes ?? 0;
  const failures = entry?.verified_failures ?? 0;
  if (successes === 0 && failures === 0) {
    return "No verified history";
  }
  return `${successes} verified success${successes === 1 ? "" : "es"}, ${failures} verified failure${failures === 1 ? "" : "s"}`;
}

export function formatLatestStatus(status) {
  const labels = {
    verified_success: "Verified success",
    verified_failure: "Verified failure",
    mixed_verified: "Mixed verified",
    unverified_success: "Unverified success",
    unverified_or_failed: "Unverified / failed",
  };
  return labels[status] || status || "Unknown";
}

export function filterCatalogApplications(applications, { search = "", status = "all" } = {}) {
  const query = (search || "").trim().toLowerCase();
  return (applications || []).filter((entry) => {
    const matchesSearch =
      !query ||
      (entry.name || "").toLowerCase().includes(query) ||
      (entry.fingerprint || "").toLowerCase().includes(query) ||
      (entry.latestEnvironmentSummary || entry.latest_environment_summary || "")
        .toLowerCase()
        .includes(query) ||
      (entry.observedFrameworks || entry.observed_frameworks || []).some((item) =>
        item.toLowerCase().includes(query)
      ) ||
      (entry.observedStrategies || entry.observed_strategies || []).some((item) =>
        item.toLowerCase().includes(query)
      );

    const matchesStatus =
      status === "all" ||
      (status === "verified_success" && (entry.latestStatus || entry.latest_status) === "verified_success") ||
      (status === "verified_failure" && (entry.latestStatus || entry.latest_status) === "verified_failure") ||
      (status === "mixed" && (entry.latestStatus || entry.latest_status) === "mixed_verified") ||
      (status === "unverified" &&
        ["unverified_success", "unverified_or_failed"].includes(
          entry.latestStatus || entry.latest_status
        ));

    return matchesSearch && matchesStatus;
  });
}

/** Build a read-only catalog view for the Compatibility Catalog page. */
export function buildCatalogView(response) {
  if (!response) return null;
  const applications = (response.applications || []).map((entry) => ({
    fingerprint: entry.fingerprint,
    name: entry.name,
    totalSessions: entry.total_sessions,
    verifiedSuccesses: entry.verified_successes,
    verifiedFailures: entry.verified_failures,
    verifiedHistory: formatVerifiedHistory(entry),
    latestStatus: entry.latest_status,
    latestStatusLabel: formatLatestStatus(entry.latest_status),
    latestSession: entry.latest_session,
    lastRegressionChange: entry.last_regression_change,
    observedFrameworks: entry.observed_frameworks || [],
    observedStrategies: entry.observed_strategies || [],
    latestEnvironmentSummary: entry.latest_environment_summary,
    explorerHref: `/explorer?fingerprint=${encodeURIComponent(entry.fingerprint || "")}`,
  }));

  return {
    schemaVersion: response.schema_version,
    generatedAt: response.generated_at,
    applications,
  };
}

/** Catalog copy avoids remediation / execution language. */
export function catalogViewAvoidsExecutionLanguage(view) {
  const serialized = JSON.stringify(view || {}).toLowerCase();
  const banned = [
    "recommended strategy",
    "auto-retry",
    "remediation",
    "install dependency",
    "execute fix",
  ];
  return !banned.some((term) => serialized.includes(term));
}
