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

/** Read-only compatibility advisor explanation derived from graph/knowledge/regression layers. */
export default function ExplorerAdvisorDetail({ advisorView, aiWordingEnabled, onToggleAiWording }) {
  const [expandedId, setExpandedId] = useState(null);
  if (!advisorView) return null;

  const categories = Object.keys(advisorView.groupedObservations || {});

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Compatibility Advisor
          </h2>
          <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={Boolean(aiWordingEnabled)}
              onChange={(event) => onToggleAiWording?.(event.target.checked)}
            />
            AI wording
          </label>
        </div>
        <p className="text-[11px] text-gray-500">{advisorView.renderStatusLabel}</p>
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          {advisorView.summary}
        </p>
        <p className="text-[11px] text-gray-500">
          Read-only explanation — no execution recommendations.
        </p>
      </div>

      {categories.map((category) => (
        <div
          key={category}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {advisorView.groupedObservations[category][0]?.categoryLabel || category}
            </h3>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {advisorView.groupedObservations[category].map((observation) => (
              <li key={observation.id} className="px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {observation.title}
                  </span>
                  <SeverityBadge severity={observation.severityTone} />
                  <span className="text-[10px] uppercase tracking-wide text-gray-500">
                    {observation.sourceLayer}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    confidence {formatConfidence(observation.confidence)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {observation.statement}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(expandedId === observation.id ? null : observation.id)
                  }
                  className="text-xs text-teal-700 dark:text-teal-300 hover:underline"
                >
                  {expandedId === observation.id ? "Hide evidence" : "View evidence"}
                </button>
                {expandedId === observation.id && (
                  <ProvenanceList provenance={observation.provenance} />
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {advisorView.limitations?.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Limitations</h3>
          <ul className="text-xs text-amber-900 dark:text-amber-100 space-y-1">
            {advisorView.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
