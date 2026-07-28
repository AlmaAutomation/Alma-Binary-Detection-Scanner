import React, { useState } from "react";
import { formatConfidence } from "../api/graphModel";

function SeverityBadge({ severity }) {
  const tones = {
    critical: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    info: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    notice: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${
        tones[severity] || tones.info
      }`}
    >
      {severity}
    </span>
  );
}

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

function StateSnapshot({ title, snapshot }) {
  if (!snapshot) return null;
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{title}</div>
      <div className="font-medium text-gray-900 dark:text-gray-100">{snapshot.label}</div>
      <div className="text-gray-500">{snapshot.dimension}: {snapshot.value}</div>
      <ProvenanceList provenance={snapshot.evidence_references} />
    </div>
  );
}

/** Read-only compatibility regression findings derived from profile comparison. */
export default function ExplorerRegressionDetail({ regressionView }) {
  const [expandedId, setExpandedId] = useState(null);
  if (!regressionView) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Compatibility Regression Comparison
        </h2>
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-gray-500">Application</div>
            <div className="font-medium">{regressionView.applicationName || "—"}</div>
            <div className="font-mono text-gray-500 break-all">
              {regressionView.applicationFingerprint || "—"}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Comparison session</div>
            <div className="font-mono break-all">{regressionView.comparisonSessionId || "—"}</div>
            <div className="text-gray-500 mt-1">
              baseline {regressionView.baselineSessionCount} · current{" "}
              {regressionView.currentSessionCount}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-gray-500">
          Findings compare aggregated knowledge before and after including the comparison session.
          Observed changes are evidence-derived — not execution recommendations.
        </p>
      </div>

      {!regressionView.hasFindings && regressionView.unchangedSummary && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 text-xs text-gray-600 dark:text-gray-300">
          {regressionView.unchangedSummary}
        </div>
      )}

      {regressionView.findings.map((finding) => {
        const open = expandedId === finding.id;
        return (
          <div
            key={finding.id}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={finding.severity} />
              <span className="text-xs font-mono text-gray-500">{finding.type}</span>
              <span className="text-xs text-gray-500">
                confidence {formatConfidence(finding.confidence)}
              </span>
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {finding.subject}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300">{finding.summary}</p>
            <button
              type="button"
              onClick={() => setExpandedId(open ? null : finding.id)}
              className="text-xs text-teal-700 dark:text-teal-300 hover:underline"
            >
              {open ? "Hide before/after evidence" : "Show before/after evidence"}
            </button>
            {open && (
              <div className="grid md:grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                <StateSnapshot title="Previous state" snapshot={finding.previousState} />
                <StateSnapshot title="Current state" snapshot={finding.currentState} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
