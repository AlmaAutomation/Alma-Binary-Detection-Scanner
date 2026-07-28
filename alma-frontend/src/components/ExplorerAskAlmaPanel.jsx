import React, { useState } from "react";
import { formatConfidence } from "../api/graphModel";
import { SUGGESTED_QUESTIONS } from "../api/askModel";

function ProvenanceList({ provenance }) {
  if (!provenance?.length) {
    return <p className="text-xs text-gray-500">No evidence references recorded.</p>;
  }
  return (
    <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-300">
      {provenance.map((ref, idx) => (
        <li key={`${ref.source_layer}-${ref.source_type}-${ref.source_id}-${idx}`} className="font-mono">
          {ref.source_layer}:{ref.source_type}:{ref.source_id}
          {ref.session_id ? ` · session ${ref.session_id}` : ""}
          {ref.attempt_id != null ? ` · attempt ${ref.attempt_id}` : ""}
        </li>
      ))}
    </ul>
  );
}

/** Scoped Ask Alma panel for the loaded application or session. */
export default function ExplorerAskAlmaPanel({
  applicationName,
  applicationFingerprint,
  sessionId,
  onAsk,
  loading,
  error,
  askView,
  aiWordingEnabled,
  onToggleAiWording,
}) {
  const [question, setQuestion] = useState("");
  const [expandedEvidence, setExpandedEvidence] = useState(false);

  const submit = (value) => {
    const trimmed = (value ?? question).trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    onAsk?.(trimmed);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Ask Alma about {applicationName || "this application"}
            </h2>
            <p className="text-[11px] text-gray-500 mt-1">
              Scoped to loaded evidence only — not a global chatbot.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={Boolean(aiWordingEnabled)}
              onChange={(event) => onToggleAiWording?.(event.target.checked)}
            />
            AI wording
          </label>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What changed in the latest session?"
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-2 text-sm rounded-lg bg-teal-600 text-white disabled:opacity-50"
          >
            Ask
          </button>
        </form>

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Suggested questions</div>
          <div className="flex flex-wrap gap-2">
            {(SUGGESTED_QUESTIONS).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => submit(item)}
                className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/20 p-4 text-sm text-sky-900 dark:text-sky-100">
          Answering from Alma evidence…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 p-4 text-sm text-rose-900 dark:text-rose-100">
          {error}
        </div>
      )}

      {askView && !loading && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
          <div className="text-[11px] text-gray-500">{askView.renderStatusLabel}</div>
          <div className="text-xs text-gray-500">Question type: {askView.questionType}</div>
          <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed">{askView.answer}</p>
          <div className="text-xs text-gray-500">
            Confidence {formatConfidence(askView.confidence)}
          </div>
          <button
            type="button"
            onClick={() => setExpandedEvidence((open) => !open)}
            className="text-xs text-teal-700 dark:text-teal-300 hover:underline"
          >
            {expandedEvidence ? "Hide evidence" : "View evidence"}
          </button>
          {expandedEvidence && <ProvenanceList provenance={askView.provenance} />}
          {askView.limitations?.length > 0 && (
            <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
              {askView.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
