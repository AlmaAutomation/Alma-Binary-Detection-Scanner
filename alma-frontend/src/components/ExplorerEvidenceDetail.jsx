import React, { useState } from "react";
import { formatConfidence } from "../api/graphModel";

function ProvenanceList({ provenance }) {
  if (!provenance?.length) {
    return <p className="text-xs text-gray-500">No provenance recorded.</p>;
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

function EvidenceSection({ title, items, emptyLabel }) {
  if (!items?.length) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
        <p className="text-xs text-gray-500 mt-2">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {items.map((item) => (
        <div key={item.edgeId || item.nodeId || item.label} className="text-xs space-y-1">
          <div className="font-medium text-gray-900 dark:text-gray-100">{item.label || item.value}</div>
          {item.scope && <div className="text-gray-500 font-mono">scope {item.scope}</div>}
          {item.confidence != null && (
            <div className="text-gray-500">confidence {formatConfidence(item.confidence)}</div>
          )}
          <ProvenanceList provenance={item.provenance} />
        </div>
      ))}
    </div>
  );
}

function RelationshipTable({ relationships, expandedEdgeId, onToggleEdge }) {
  if (!relationships.length) {
    return <p className="text-xs text-gray-500">No graph relationships ingested.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 pr-3">Relationship</th>
            <th className="py-2 pr-3">Source</th>
            <th className="py-2 pr-3">Target</th>
            <th className="py-2 pr-3">Scope</th>
            <th className="py-2 w-20" />
          </tr>
        </thead>
        <tbody>
          {relationships.map((row) => {
            const open = expandedEdgeId === row.edgeId;
            return (
              <React.Fragment key={row.edgeId}>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-3">{row.edgeType}</td>
                  <td className="py-2 pr-3">{row.sourceLabel}</td>
                  <td className="py-2 pr-3">{row.targetLabel}</td>
                  <td className="py-2 pr-3 font-mono">{row.scope}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => onToggleEdge(open ? null : row.edgeId)}
                      className="text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      {open ? "Hide" : "Provenance"}
                    </button>
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={5} className="pb-3">
                      <ProvenanceList provenance={row.provenance} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Evidence-oriented read-only session detail derived from a Compatibility Graph subgraph. */
export default function ExplorerEvidenceDetail({ evidenceView }) {
  const [expandedEdgeId, setExpandedEdgeId] = useState(null);
  if (!evidenceView) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Session evidence</h2>
          {evidenceView.verificationStatus.verified ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              Authoritative verification
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              Unverified
            </span>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-gray-500">Application</div>
            <div className="font-medium">{evidenceView.applicationIdentity.name || "—"}</div>
            <div className="font-mono text-gray-500 break-all">
              {evidenceView.applicationIdentity.fingerprint || "—"}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Session</div>
            <div className="font-mono break-all">{evidenceView.sessionId || "—"}</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <EvidenceSection
          title="Framework observations"
          items={evidenceView.frameworks}
          emptyLabel="No framework evidence ingested."
        />
        <EvidenceSection
          title="Launch strategy"
          items={evidenceView.launchStrategies}
          emptyLabel="No launch strategy evidence ingested."
        />
        <EvidenceSection
          title="Verification contract"
          items={evidenceView.verificationStatus.contracts}
          emptyLabel="No authoritative verification contract."
        />
        <EvidenceSection
          title="Observed runtimes"
          items={evidenceView.observedRuntimes}
          emptyLabel="No runtime observations from manifest evidence."
        />
      </div>

      {evidenceView.conflicts.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Conflicting evidence
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber-100">
            {evidenceView.conflicts.map((item, idx) => (
              <li key={`${item.kind}-${idx}`}>{item.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Graph relationships ({evidenceView.relationships.length})
        </h3>
        <RelationshipTable
          relationships={evidenceView.relationships}
          expandedEdgeId={expandedEdgeId}
          onToggleEdge={setExpandedEdgeId}
        />
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        Nodes {evidenceView.nodes.length} · Edges {evidenceView.edges.length}
        {evidenceView.allEdgesHaveProvenance ? " · all relationships include provenance" : ""}
      </div>
    </div>
  );
}
