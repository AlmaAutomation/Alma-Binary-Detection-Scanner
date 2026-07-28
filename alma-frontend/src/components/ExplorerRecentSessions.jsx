import React, { useEffect, useMemo, useState } from "react";
import { fetchRecentSessions } from "../api/recentSessionsClient";
import {
  LEGACY_GRAPH_MESSAGE,
  abbreviateSessionId,
  classifyRecentSessionsError,
  formatRelativeTime,
  partitionRecentSessions,
} from "../api/recentSessionsModel";

function SessionBadge({ verified }) {
  return verified ? (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
      Verified
    </span>
  ) : (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      Unverified
    </span>
  );
}

function SessionRow({ session, onOpenSession, onOpenKnowledge, actionLabel = "Open in Explorer" }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {session.application_name || "Unknown application"}
          </span>
          <SessionBadge verified={session.verified} />
          <span className="text-[10px] uppercase tracking-wide text-gray-500">{session.state}</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
          Session {abbreviateSessionId(session.session_id)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {formatRelativeTime(session.finished_at || session.started_at)}
        </div>
      </div>
      <div className="shrink-0 flex flex-wrap gap-2">
        {session.graph_compatible ? (
          <>
            <button
              type="button"
              onClick={() => onOpenSession(session.session_id)}
              className="px-3 py-1.5 text-xs rounded-lg bg-teal-600 text-white hover:bg-teal-700"
            >
              {actionLabel}
            </button>
            {onOpenKnowledge && session.application_fingerprint ? (
              <button
                type="button"
                onClick={() => onOpenKnowledge(session.application_fingerprint)}
                className="px-3 py-1.5 text-xs rounded-lg border border-teal-600 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/30"
              >
                Knowledge
              </button>
            ) : null}
          </>
        ) : (
          <span className="inline-flex px-3 py-1.5 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            Graph unavailable
          </span>
        )}
      </div>
    </div>
  );
}

/** Read-only list of recent Bridge sessions with graph-compatible sessions prioritized. */
export default function ExplorerRecentSessions({ onOpenSession, onOpenKnowledge }) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [errorKind, setErrorKind] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [legacyOpen, setLegacyOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorKind("");
      setErrorMessage("");
      try {
        const data = await fetchRecentSessions(20);
        if (!cancelled) setSessions(data?.sessions || []);
      } catch (err) {
        if (!cancelled) {
          const classified = classifyRecentSessionsError(err);
          setErrorKind(classified.kind);
          setErrorMessage(classified.message);
          setSessions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { compatible, legacy } = useMemo(
    () => partitionRecentSessions(sessions),
    [sessions]
  );

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Sessions</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Graph-compatible sessions appear first. Verified runs with fingerprint evidence open directly
          in Explorer.
        </p>
      </div>

      {loading && (
        <div className="text-xs text-gray-500 dark:text-gray-400 py-4">Loading recent sessions…</div>
      )}

      {!loading && errorKind && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-800 dark:text-rose-200">
          {errorKind === "offline" ? "Backend offline" : "Could not load sessions"} — {errorMessage}
        </div>
      )}

      {!loading && !errorKind && sessions.length === 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 text-xs text-gray-500 dark:text-gray-400">
          No session history yet. Run an application through Bridge to populate recent sessions.
        </div>
      )}

      {!loading && !errorKind && compatible.length > 0 && (
        <div className="space-y-2">
          {compatible.map((session) => (
            <SessionRow
              key={session.session_id}
              session={session}
              onOpenSession={onOpenSession}
              onOpenKnowledge={onOpenKnowledge}
            />
          ))}
        </div>
      )}

      {!loading && !errorKind && compatible.length === 0 && legacy.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          No graph-compatible sessions yet. Expand legacy sessions below for historical metadata.
        </div>
      )}

      {!loading && !errorKind && legacy.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <button
            type="button"
            onClick={() => setLegacyOpen((open) => !open)}
            className="text-xs font-medium text-gray-700 dark:text-gray-200 hover:underline"
          >
            {legacyOpen ? "Hide" : "Show"} Legacy sessions ({legacy.length})
          </button>
          {legacyOpen && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                {LEGACY_GRAPH_MESSAGE}
              </p>
              <div className="space-y-2">
                {legacy.map((session) => (
                  <SessionRow
                    key={session.session_id}
                    session={session}
                    onOpenSession={onOpenSession}
                    actionLabel="View metadata"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
