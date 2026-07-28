import React, { useState } from "react";
import { formatConfidence } from "../api/graphModel";

function ProvenanceList({ provenance }) {
  if (!provenance?.length) {
    return <p className="text-xs text-gray-500">No evidence references recorded.</p>;
  }
  return (
    <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-300">
      {provenance.map((ref, idx) => (
        <li key={`${ref.source_type}-${ref.source_id}-${idx}`} className="font-mono">
          {ref.source_type}:{ref.source_id}
          {ref.session_id ? ` · session ${ref.session_id}` : ""}
          {ref.attempt_id != null ? ` · attempt ${ref.attempt_id}` : ""}
        </li>
      ))}
    </ul>
  );
}

function AggregateSection({ title, rows, renderMeta }) {
  if (!rows?.length) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
        <p className="text-xs text-gray-500 mt-2">No observations recorded.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {rows.map((row) => (
        <div key={row.key} className="text-xs space-y-1 border-t border-gray-100 dark:border-gray-800 pt-2 first:border-t-0 first:pt-0">
          <div className="font-medium text-gray-900 dark:text-gray-100">{row.label}</div>
          {renderMeta(row)}
          <ProvenanceList provenance={row.provenance} />
        </div>
      ))}
    </div>
  );
}

/** Read-only application-level compatibility knowledge derived from aggregated evidence. */
export default function ExplorerKnowledgeDetail({ knowledgeView }) {
  const [expandedConflict, setExpandedConflict] = useState(null);
  if (!knowledgeView) return null;

  const stats = knowledgeView.sessionStats;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Compatibility Summary
        </h2>
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-gray-500">Application</div>
            <div className="font-medium">{knowledgeView.applicationName || "—"}</div>
            <div className="font-mono text-gray-500 break-all">
              {knowledgeView.applicationFingerprint || "—"}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Generated</div>
            <div className="font-mono">{knowledgeView.generatedAt || "—"}</div>
            <div className="text-gray-500 mt-1">schema {knowledgeView.schemaVersion}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Session statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-gray-500">Total sessions</div>
            <div className="text-lg font-semibold">{stats.total}</div>
          </div>
          <div>
            <div className="text-gray-500">Verified successes</div>
            <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              {stats.verifiedSuccesses}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Verified failures</div>
            <div className="text-lg font-semibold text-rose-700 dark:text-rose-300">
              {stats.verifiedFailures}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Unverifiable</div>
            <div className="text-lg font-semibold">{stats.unverifiable}</div>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-3">
          Success metrics reflect authoritative verification passes only — not exit codes or route
          success.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <AggregateSection
          title="Framework observations"
          rows={knowledgeView.frameworks}
          renderMeta={(row) => (
            <>
              <div className="text-gray-500">
                observations {row.observationCount} · verified sessions {row.verifiedSessionCount}
              </div>
              <div className="text-gray-500">
                classification {row.classification} · confidence {formatConfidence(row.confidence)}
              </div>
            </>
          )}
        />
        <AggregateSection
          title="Launch strategies"
          rows={knowledgeView.strategies}
          renderMeta={(row) => (
            <div className="text-gray-500">
              attempts {row.attempts} · verified successes {row.verifiedSuccesses} · verified
              failures {row.verifiedFailures} · observed rate {formatConfidence(row.successRate)}
            </div>
          )}
        />
        <AggregateSection
          title="Verification contracts"
          rows={knowledgeView.contracts}
          renderMeta={(row) => (
            <div className="text-gray-500">
              passed {row.passedCount} · failed {row.failedCount}
            </div>
          )}
        />
        <AggregateSection
          title="Observed runtimes"
          rows={knowledgeView.runtimes}
          renderMeta={(row) => (
            <div className="text-gray-500">
              observations {row.observationCount} · verified-success observations{" "}
              {row.verifiedSuccessObservationCount}
            </div>
          )}
        />
      </div>

      {knowledgeView.conflicts.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Conflicting evidence
          </h3>
          <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
            Competing observations are preserved — no framework is selected as authoritative.
          </p>
          {knowledgeView.conflicts.map((conflict) => {
            const open = expandedConflict === conflict.relationship;
            return (
              <div key={conflict.relationship} className="text-xs space-y-2">
                <div className="font-medium text-amber-900 dark:text-amber-100">{conflict.message}</div>
                <button
                  type="button"
                  onClick={() => setExpandedConflict(open ? null : conflict.relationship)}
                  className="text-teal-700 dark:text-teal-300 hover:underline"
                >
                  {open ? "Hide evidence by side" : "Show evidence by side"}
                </button>
                {open &&
                  Object.entries(conflict.evidenceBySide).map(([side, refs]) => (
                    <div key={side}>
                      <div className="font-medium">{side}</div>
                      <ProvenanceList provenance={refs} />
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
