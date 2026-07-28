/**
 * Presentation helpers for recent Bridge session rows.
 */

export function formatRelativeTime(isoTimestamp) {
  if (!isoTimestamp) return "—";
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return isoTimestamp;
  const deltaMs = Date.now() - then;
  const minutes = Math.round(deltaMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function abbreviateSessionId(sessionId) {
  if (!sessionId) return "";
  if (sessionId.length <= 16) return sessionId;
  return `${sessionId.slice(0, 8)}…`;
}

export function explorerSessionPath(sessionId) {
  return `/explorer?session=${encodeURIComponent(sessionId)}`;
}

export function classifyRecentSessionsError(err) {
  if (!err?.response && err?.request) {
    return { kind: "offline", message: "Bridge backend is offline or unreachable." };
  }
  const status = err?.response?.status;
  if (status === 404) {
    return { kind: "not_found", message: "Recent sessions endpoint not found." };
  }
  const detail = err?.response?.data?.detail;
  const message =
    typeof detail === "string"
      ? detail
      : detail?.message || err?.message || "Failed to load recent sessions.";
  return { kind: "error", message };
}

export const LEGACY_GRAPH_MESSAGE =
  "These sessions were created without the evidence required by Compatibility Graph v1. Run the application again to generate graph-compatible evidence.";

function sessionTimestamp(session) {
  return new Date(session?.finished_at || session?.started_at || 0).getTime();
}

/** Graph-compatible sessions first; verified preferred; newest within each group. */
export function partitionRecentSessions(sessions) {
  const compatible = [];
  const legacy = [];
  for (const session of sessions || []) {
    if (session.graph_compatible) compatible.push(session);
    else legacy.push(session);
  }
  const byVerifiedThenRecent = (a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    return sessionTimestamp(b) - sessionTimestamp(a);
  };
  compatible.sort(byVerifiedThenRecent);
  legacy.sort((a, b) => sessionTimestamp(b) - sessionTimestamp(a));
  return { compatible, legacy };
}
