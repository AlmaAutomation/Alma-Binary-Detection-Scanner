import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchApplicationGraph,
  fetchGraphEdge,
  fetchGraphNode,
  fetchSessionGraph,
} from "../api/graphClient";
import { fetchApplicationKnowledge } from "../api/knowledgeClient";
import { fetchApplicationRegression } from "../api/regressionClient";
import { fetchApplicationAdvisor, fetchSessionAdvisor } from "../api/advisorClient";
import {
  classifyGraphError,
  findConflictingEvidence,
  formatConfidence,
  isVerifiedEdge,
  nodeDisplayLabel,
  sortEdges,
  sortNodes,
  summarizeSubgraph,
  truncateId,
} from "../api/graphModel";
import { buildEvidenceView } from "../api/graphEvidenceView";
import { buildKnowledgeView, classifyKnowledgeError } from "../api/knowledgeModel";
import { buildRegressionView, classifyRegressionError } from "../api/regressionModel";
import { buildAdvisorView, classifyAdvisorError } from "../api/advisorModel";
import { postAskAlma } from "../api/askClient";
import { buildAskView, classifyAskError } from "../api/askModel";
import ExplorerEvidenceDetail from "./ExplorerEvidenceDetail";
import ExplorerKnowledgeDetail from "./ExplorerKnowledgeDetail";
import ExplorerRegressionDetail from "./ExplorerRegressionDetail";
import ExplorerAdvisorDetail from "./ExplorerAdvisorDetail";
import ExplorerAskAlmaPanel from "./ExplorerAskAlmaPanel";
import ExplorerRecentSessions from "./ExplorerRecentSessions";

const SEARCH_MODES = [
  { id: "fingerprint", label: "Application fingerprint" },
  { id: "session", label: "Session ID" },
];

function Badge({ tone, children }) {
  const tones = {
    verified:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    unverified:
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    warning:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    info: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${
        tones[tone] || tones.info
      }`}
    >
      {children}
    </span>
  );
}

function StateBanner({ tone, title, detail, errors }) {
  const styles = {
    loading: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
    empty: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
    not_found: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    malformed: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
    error: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
  };
  return (
    <div className={`rounded-xl border p-4 text-sm ${styles[tone] || styles.empty}`}>
      <div className="font-medium">{title}</div>
      {detail && <p className="mt-1 text-xs opacity-90">{detail}</p>}
      {errors?.length > 0 && (
        <ul className="mt-2 text-xs list-disc list-inside opacity-90">
          {errors.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JsonBlock({ value }) {
  return (
    <pre className="mt-2 p-3 rounded-lg bg-gray-100 dark:bg-gray-900 text-[11px] overflow-x-auto font-mono text-gray-800 dark:text-gray-200">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ProvenanceTable({ references }) {
  if (!references?.length) {
    return <p className="text-xs text-gray-500">No provenance references.</p>;
  }
  return (
    <div className="overflow-x-auto mt-2">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="py-1 pr-3 font-medium">Source type</th>
            <th className="py-1 pr-3 font-medium">Source ID</th>
            <th className="py-1 pr-3 font-medium">Session</th>
            <th className="py-1 pr-3 font-medium">Attempt</th>
            <th className="py-1 font-medium">Captured</th>
          </tr>
        </thead>
        <tbody>
          {references.map((ref, idx) => (
            <tr
              key={`${ref.source_type}-${ref.source_id}-${idx}`}
              className="border-b border-gray-100 dark:border-gray-800"
            >
              <td className="py-1.5 pr-3 font-mono">{ref.source_type}</td>
              <td className="py-1.5 pr-3 font-mono">{ref.source_id}</td>
              <td className="py-1.5 pr-3 font-mono">{ref.session_id || "—"}</td>
              <td className="py-1.5 pr-3">{ref.attempt_id ?? "—"}</td>
              <td className="py-1.5 font-mono text-gray-500">{ref.captured_at || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailPanel({ loading, error, children }) {
  if (loading) {
    return (
      <div className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50">
        Loading detail…
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-4 py-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30">
        {error}
      </div>
    );
  }
  return (
    <div className="px-4 py-3 text-xs bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 space-y-2">
      {children}
    </div>
  );
}

function NodeDetailPanel({ nodeId, cachedNode, detail, loading, error }) {
  const node = detail || cachedNode;
  if (!node) return null;
  return (
    <DetailPanel loading={loading} error={error}>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <div className="text-gray-500 dark:text-gray-400">Node ID</div>
          <div className="font-mono break-all">{node.node_id}</div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-gray-400">Type</div>
          <div>{node.node_type}</div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-gray-400">Identity key</div>
          <div className="font-mono break-all">{node.identity_key}</div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-gray-400">Created</div>
          <div className="font-mono">{node.created_at || "—"}</div>
        </div>
      </div>
      <div>
        <div className="text-gray-500 dark:text-gray-400">Attributes</div>
        <JsonBlock value={node.attributes || {}} />
      </div>
    </DetailPanel>
  );
}

function EdgeDetailPanel({ edgeId, cachedEdge, detail, loading, error, nodesById }) {
  const edge = detail || cachedEdge;
  if (!edge) return null;
  const source = nodesById[edge.source_node_id];
  const target = nodesById[edge.target_node_id];
  return (
    <DetailPanel loading={loading} error={error}>
      <div className="flex flex-wrap gap-2 items-center">
        <Badge tone={isVerifiedEdge(edge) ? "verified" : "unverified"}>
          {isVerifiedEdge(edge) ? "Verified" : "Observed"}
        </Badge>
        <span className="text-gray-500">confidence {formatConfidence(edge.confidence)}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <div className="text-gray-500 dark:text-gray-400">Edge ID</div>
          <div className="font-mono break-all">{edge.edge_id}</div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-gray-400">Scope</div>
          <div className="font-mono">{edge.scope}</div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-gray-400">Source</div>
          <div>{source ? nodeDisplayLabel(source) : truncateId(edge.source_node_id)}</div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-gray-400">Target</div>
          <div>{target ? nodeDisplayLabel(target) : truncateId(edge.target_node_id)}</div>
        </div>
      </div>
      <div>
        <div className="font-medium text-gray-700 dark:text-gray-200">Evidence provenance</div>
        <ProvenanceTable references={edge.evidence_references} />
      </div>
    </DetailPanel>
  );
}

function SubgraphSummary({ subgraph, summary, conflicts }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Subgraph summary
        </h2>
        {summary.hasVerifiedLaunch ? (
          <Badge tone="verified">Verified launch</Badge>
        ) : (
          <Badge tone="unverified">No verified_by edge</Badge>
        )}
        {conflicts.length > 0 && (
          <Badge tone="warning">{conflicts.length} conflict(s)</Badge>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Nodes</div>
          <div className="text-2xl font-semibold font-mono mt-1">{summary.nodeCount}</div>
        </div>
        <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Edges</div>
          <div className="text-2xl font-semibold font-mono mt-1">{summary.edgeCount}</div>
        </div>
        <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Verified edges</div>
          <div className="text-2xl font-semibold font-mono mt-1 text-emerald-600">
            {summary.verifiedEdgeCount}
          </div>
        </div>
        <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Framework observations</div>
          <div className="text-2xl font-semibold font-mono mt-1">
            {summary.frameworkObservationCount}
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono space-y-0.5">
        {subgraph.application_fingerprint && (
          <div>fingerprint: {subgraph.application_fingerprint}</div>
        )}
        {subgraph.session_id && <div>session: {subgraph.session_id}</div>}
        <div>schema: {summary.schemaVersion || "—"} · engine: {summary.engineVersion || "—"}</div>
        {summary.ingestedAt && <div>ingested: {summary.ingestedAt}</div>}
      </div>
    </div>
  );
}

function ExpandableTable({
  title,
  columns,
  rows,
  getRowKey,
  renderCells,
  expandedKey,
  onToggle,
  renderDetail,
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50">
              {columns.map((col) => (
                <th key={col} className="px-4 py-2 font-medium">
                  {col}
                </th>
              ))}
              <th className="px-4 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = getRowKey(row);
              const open = expandedKey === key;
              return (
                <React.Fragment key={key}>
                  <tr className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    {renderCells(row)}
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => onToggle(open ? null : key)}
                        className="text-teal-600 dark:text-teal-400 hover:underline"
                      >
                        {open ? "Hide" : "Detail"}
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={columns.length + 1} className="p-0">
                        {renderDetail(row)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="px-4 py-6 text-xs text-gray-500 text-center">No rows.</div>
      )}
    </div>
  );
}

/** Read-only Compatibility Graph explorer — tables and expandable detail panels. */
export default function CompatibilityExplorerPanel() {
  const [searchParams] = useSearchParams();
  const [searchMode, setSearchMode] = useState("fingerprint");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewState, setViewState] = useState("empty");
  const [stateDetail, setStateDetail] = useState("");
  const [stateErrors, setStateErrors] = useState([]);
  const [subgraph, setSubgraph] = useState(null);
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const [expandedEdgeId, setExpandedEdgeId] = useState(null);
  const [nodeDetail, setNodeDetail] = useState(null);
  const [edgeDetail, setEdgeDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState("");
  const [detailError, setDetailError] = useState("");
  const [applicationViewTab, setApplicationViewTab] = useState("graph");
  const [knowledgeProfile, setKnowledgeProfile] = useState(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState("");
  const [regressionReport, setRegressionReport] = useState(null);
  const [regressionLoading, setRegressionLoading] = useState(false);
  const [regressionError, setRegressionError] = useState("");
  const [advisorExplanation, setAdvisorExplanation] = useState(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState("");
  const [advisorAiWording, setAdvisorAiWording] = useState(false);
  const [askAnswer, setAskAnswer] = useState(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState("");
  const [askAiWording, setAskAiWording] = useState(false);

  const loadGraph = useCallback(async (mode, value, options = {}) => {
    const trimmed = (value || "").trim();
    if (!trimmed) {
      setViewState("empty");
      setStateDetail("Enter an application fingerprint or session ID to explore.");
      setSubgraph(null);
      setSubmittedQuery("");
      return;
    }

    setSearchMode(mode);
    setQuery(trimmed);
    setLoading(true);
    setViewState("loading");
    setStateDetail("");
    setStateErrors([]);
    setSubgraph(null);
    setExpandedNodeId(null);
    setExpandedEdgeId(null);
    setNodeDetail(null);
    setEdgeDetail(null);
    setSubmittedQuery(trimmed);
    setApplicationViewTab(options.applicationViewTab || "graph");
    setKnowledgeProfile(null);
    setKnowledgeError("");
    setRegressionReport(null);
    setRegressionError("");
    setAdvisorExplanation(null);
    setAdvisorError("");
    setAskAnswer(null);
    setAskError("");

    try {
      const data =
        mode === "session" ? await fetchSessionGraph(trimmed) : await fetchApplicationGraph(trimmed);
      setSubgraph(data);
      setViewState("success");
    } catch (err) {
      const classified = classifyGraphError(err);
      setViewState(classified.kind);
      setStateDetail(classified.message);
      setStateErrors(classified.errors || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const runSearch = useCallback(() => {
    loadGraph(searchMode, query);
  }, [loadGraph, query, searchMode]);

  const openSessionInExplorer = useCallback(
    (sessionId) => {
      loadGraph("session", sessionId);
    },
    [loadGraph]
  );

  const openKnowledgeForFingerprint = useCallback(
    (fingerprint) => {
      loadGraph("fingerprint", fingerprint, { applicationViewTab: "knowledge" });
    },
    [loadGraph]
  );

  const openRegressionsForFingerprint = useCallback(
    (fingerprint) => {
      loadGraph("fingerprint", fingerprint, { applicationViewTab: "regressions" });
    },
    [loadGraph]
  );

  const openAdvisorForFingerprint = useCallback(
    (fingerprint) => {
      loadGraph("fingerprint", fingerprint, { applicationViewTab: "advisor" });
    },
    [loadGraph]
  );

  const loadKnowledge = useCallback(async (fingerprint) => {
    const trimmed = (fingerprint || "").trim();
    if (!trimmed) return;
    setKnowledgeLoading(true);
    setKnowledgeError("");
    setKnowledgeProfile(null);
    try {
      const data = await fetchApplicationKnowledge(trimmed);
      setKnowledgeProfile(data);
    } catch (err) {
      const classified = classifyKnowledgeError(err);
      setKnowledgeError(classified.message);
    } finally {
      setKnowledgeLoading(false);
    }
  }, []);

  const loadRegression = useCallback(async (fingerprint) => {
    const trimmed = (fingerprint || "").trim();
    if (!trimmed) return;
    setRegressionLoading(true);
    setRegressionError("");
    setRegressionReport(null);
    try {
      const data = await fetchApplicationRegression(trimmed);
      setRegressionReport(data);
    } catch (err) {
      const classified = classifyRegressionError(err);
      setRegressionError(classified.message);
    } finally {
      setRegressionLoading(false);
    }
  }, []);

  const loadAdvisor = useCallback(async (fingerprint, sessionId, render = "deterministic") => {
    const trimmed = (fingerprint || "").trim();
    const sessionTrimmed = (sessionId || "").trim();
    if (!trimmed && !sessionTrimmed) return;
    setAdvisorLoading(true);
    setAdvisorError("");
    setAdvisorExplanation(null);
    try {
      const data = sessionTrimmed
        ? await fetchSessionAdvisor(sessionTrimmed, render)
        : await fetchApplicationAdvisor(trimmed, sessionId, render);
      setAdvisorExplanation(data);
    } catch (err) {
      const classified = classifyAdvisorError(err);
      setAdvisorError(classified.message);
    } finally {
      setAdvisorLoading(false);
    }
  }, []);

  const applicationFingerprint = useMemo(() => {
    if (subgraph?.application_fingerprint) {
      return subgraph.application_fingerprint;
    }
    if (searchMode === "fingerprint") {
      return submittedQuery;
    }
    return null;
  }, [subgraph, searchMode, submittedQuery]);

  const submitAsk = useCallback(
    async (question) => {
      if (!applicationFingerprint) return;
      setAskLoading(true);
      setAskError("");
      setAskAnswer(null);
      try {
        const data = await postAskAlma({
          question,
          applicationFingerprint,
          sessionId: searchMode === "session" ? submittedQuery : null,
          render: askAiWording ? "llm" : "deterministic",
        });
        setAskAnswer(data);
      } catch (err) {
        const classified = classifyAskError(err);
        setAskError(classified.message);
      } finally {
        setAskLoading(false);
      }
    },
    [applicationFingerprint, searchMode, submittedQuery, askAiWording]
  );

  useEffect(() => {
    if (viewState === "success" && applicationFingerprint) {
      loadRegression(applicationFingerprint);
    }
  }, [viewState, applicationFingerprint, loadRegression]);

  useEffect(() => {
    if (
      viewState === "success" &&
      applicationViewTab === "knowledge" &&
      applicationFingerprint
    ) {
      loadKnowledge(applicationFingerprint);
    }
  }, [viewState, applicationViewTab, applicationFingerprint, loadKnowledge]);

  useEffect(() => {
    if (
      viewState === "success" &&
      applicationViewTab === "advisor" &&
      (applicationFingerprint || (searchMode === "session" && submittedQuery))
    ) {
      loadAdvisor(
        applicationFingerprint,
        searchMode === "session" ? submittedQuery : null,
        advisorAiWording ? "llm" : "deterministic"
      );
    }
  }, [
    viewState,
    applicationViewTab,
    applicationFingerprint,
    searchMode,
    submittedQuery,
    advisorAiWording,
    loadAdvisor,
  ]);

  useEffect(() => {
    const deepLinkSession = searchParams.get("session");
    const deepLinkFingerprint = searchParams.get("fingerprint");
    const deepLinkView = searchParams.get("view");
    if (deepLinkSession) {
      if (deepLinkView === "advisor") {
        loadGraph("session", deepLinkSession, { applicationViewTab: "advisor" });
      } else {
        openSessionInExplorer(deepLinkSession);
      }
      return;
    }
    if (deepLinkFingerprint) {
      if (deepLinkView === "knowledge") {
        openKnowledgeForFingerprint(deepLinkFingerprint);
      } else if (deepLinkView === "regressions") {
        openRegressionsForFingerprint(deepLinkFingerprint);
      } else if (deepLinkView === "advisor") {
        openAdvisorForFingerprint(deepLinkFingerprint);
      } else if (deepLinkView === "ask") {
        loadGraph("fingerprint", deepLinkFingerprint, { applicationViewTab: "ask" });
      } else {
        loadGraph("fingerprint", deepLinkFingerprint);
      }
    }
  }, [
    searchParams,
    openSessionInExplorer,
    openKnowledgeForFingerprint,
    openRegressionsForFingerprint,
    openAdvisorForFingerprint,
    loadGraph,
  ]);

  const loadNodeDetail = useCallback(async (nodeId) => {
    setDetailLoading("node");
    setDetailError("");
    setNodeDetail(null);
    try {
      const data = await fetchGraphNode(nodeId);
      setNodeDetail(data);
    } catch (err) {
      const classified = classifyGraphError(err);
      setDetailError(classified.message);
    } finally {
      setDetailLoading("");
    }
  }, []);

  const loadEdgeDetail = useCallback(async (edgeId) => {
    setDetailLoading("edge");
    setDetailError("");
    setEdgeDetail(null);
    try {
      const data = await fetchGraphEdge(edgeId);
      setEdgeDetail(data);
    } catch (err) {
      const classified = classifyGraphError(err);
      setDetailError(classified.message);
    } finally {
      setDetailLoading("");
    }
  }, []);

  const handleToggleNode = useCallback(
    (nodeId) => {
      setExpandedEdgeId(null);
      setEdgeDetail(null);
      if (!nodeId) {
        setExpandedNodeId(null);
        setNodeDetail(null);
        return;
      }
      setExpandedNodeId(nodeId);
      loadNodeDetail(nodeId);
    },
    [loadNodeDetail]
  );

  const handleToggleEdge = useCallback(
    (edgeId) => {
      setExpandedNodeId(null);
      setNodeDetail(null);
      if (!edgeId) {
        setExpandedEdgeId(null);
        setEdgeDetail(null);
        return;
      }
      setExpandedEdgeId(edgeId);
      loadEdgeDetail(edgeId);
    },
    [loadEdgeDetail]
  );

  const summary = useMemo(
    () => (subgraph ? summarizeSubgraph(subgraph) : null),
    [subgraph]
  );
  const conflicts = useMemo(
    () => (subgraph ? findConflictingEvidence(subgraph) : []),
    [subgraph]
  );
  const nodesById = useMemo(
    () => Object.fromEntries((subgraph?.nodes || []).map((n) => [n.node_id, n])),
    [subgraph]
  );
  const sortedNodes = useMemo(() => sortNodes(subgraph?.nodes), [subgraph]);
  const sortedEdges = useMemo(() => sortEdges(subgraph?.edges), [subgraph]);
  const evidenceView = useMemo(
    () => (subgraph ? buildEvidenceView(subgraph) : null),
    [subgraph]
  );
  const knowledgeView = useMemo(
    () => (knowledgeProfile ? buildKnowledgeView(knowledgeProfile) : null),
    [knowledgeProfile]
  );
  const regressionView = useMemo(
    () => (regressionReport ? buildRegressionView(regressionReport) : null),
    [regressionReport]
  );
  const advisorView = useMemo(
    () => (advisorExplanation ? buildAdvisorView(advisorExplanation) : null),
    [advisorExplanation]
  );
  const askView = useMemo(() => buildAskView(askAnswer), [askAnswer]);
  const scopedApplicationName =
    advisorView?.applicationName ||
    knowledgeView?.applicationName ||
    regressionView?.applicationName ||
    subgraph?.nodes?.find((node) => node.node_type === "application")?.attributes?.file_path?.split("/").pop() ||
    applicationFingerprint;

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Compatibility Explorer
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Read-only view of evidence-derived compatibility graph nodes and edges. No launch,
          remediation, or ingestion controls.
        </p>
      </div>

      <ExplorerRecentSessions
        onOpenSession={openSessionInExplorer}
        onOpenKnowledge={openKnowledgeForFingerprint}
      />

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Manual search</h2>
        <div className="flex flex-wrap gap-2">
          {SEARCH_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setSearchMode(mode.id)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                searchMode === mode.id
                  ? "bg-teal-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              searchMode === "session"
                ? "e.g. 4ecb0e85-af0c-4143-8b29-668cfccad37a"
                : "Application file_hash / fingerprint"
            }
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
            aria-label={searchMode === "session" ? "Session ID" : "Application fingerprint"}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? "Searching…" : "Explore"}
          </button>
        </form>
      </div>

      {viewState === "loading" && (
        <StateBanner tone="loading" title="Loading graph…" detail={`Query: ${submittedQuery}`} />
      )}

      {viewState === "empty" && !loading && (
        <StateBanner
          tone="empty"
          title="Enter a search query"
          detail={
            stateDetail ||
            "Search by application fingerprint to see all sessions for that binary, or by session ID for a single execution subgraph."
          }
        />
      )}

      {viewState === "not_found" && (
        <StateBanner tone="not_found" title="Not found (404)" detail={stateDetail} />
      )}

      {viewState === "malformed" && (
        <StateBanner
          tone="malformed"
          title="Malformed evidence (422)"
          detail={stateDetail}
          errors={stateErrors}
        />
      )}

      {viewState === "error" && (
        <StateBanner tone="error" title="Request failed" detail={stateDetail} />
      )}

      {viewState === "success" && subgraph && summary && applicationFingerprint && (
        <div className="flex flex-wrap gap-2 items-center">
          {[
            { id: "graph", label: "Compatibility Graph" },
            { id: "knowledge", label: "Compatibility Knowledge" },
            { id: "regressions", label: "Regressions" },
            { id: "advisor", label: "Advisor" },
            { id: "ask", label: "Ask Alma" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setApplicationViewTab(tab.id)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                applicationViewTab === tab.id
                  ? "bg-teal-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {regressionView?.hasFindings && applicationViewTab !== "regressions" && (
            <Badge tone="warning">
              {regressionView.findings.length} regression finding(s) for latest session
            </Badge>
          )}
        </div>
      )}

      {viewState === "success" && subgraph && summary && applicationViewTab === "knowledge" && applicationFingerprint && (
        <>
          {knowledgeLoading && (
            <StateBanner tone="loading" title="Loading compatibility knowledge…" detail={submittedQuery} />
          )}
          {knowledgeError && !knowledgeLoading && (
            <StateBanner tone="error" title="Knowledge request failed" detail={knowledgeError} />
          )}
          {!knowledgeLoading && !knowledgeError && knowledgeView && (
            <ExplorerKnowledgeDetail knowledgeView={knowledgeView} />
          )}
        </>
      )}

      {viewState === "success" && subgraph && summary && applicationViewTab === "regressions" && applicationFingerprint && (
        <>
          {regressionLoading && (
            <StateBanner tone="loading" title="Loading compatibility regressions…" detail={submittedQuery} />
          )}
          {regressionError && !regressionLoading && (
            <StateBanner tone="error" title="Regression request failed" detail={regressionError} />
          )}
          {!regressionLoading && !regressionError && regressionView && (
            <ExplorerRegressionDetail regressionView={regressionView} />
          )}
        </>
      )}

      {viewState === "success" && subgraph && summary && applicationViewTab === "advisor" && applicationFingerprint && (
        <>
          {advisorLoading && (
            <StateBanner tone="loading" title="Loading compatibility advisor…" detail={submittedQuery} />
          )}
          {advisorError && !advisorLoading && (
            <StateBanner tone="error" title="Advisor request failed" detail={advisorError} />
          )}
          {!advisorLoading && !advisorError && advisorView && (
            <ExplorerAdvisorDetail
              advisorView={advisorView}
              aiWordingEnabled={advisorAiWording}
              onToggleAiWording={setAdvisorAiWording}
            />
          )}
        </>
      )}

      {viewState === "success" && subgraph && summary && applicationViewTab === "ask" && applicationFingerprint && (
        <ExplorerAskAlmaPanel
          applicationName={scopedApplicationName}
          applicationFingerprint={applicationFingerprint}
          sessionId={searchMode === "session" ? submittedQuery : null}
          onAsk={submitAsk}
          loading={askLoading}
          error={askError}
          askView={askView}
          aiWordingEnabled={askAiWording}
          onToggleAiWording={setAskAiWording}
        />
      )}

      {viewState === "success" && subgraph && summary && applicationViewTab === "graph" && (
        <>
          <ExplorerEvidenceDetail evidenceView={evidenceView} />
          <SubgraphSummary subgraph={subgraph} summary={summary} conflicts={conflicts} />

          <ExpandableTable
            title="Nodes"
            columns={["Type", "Label", "Identity", "Node ID"]}
            rows={sortedNodes}
            getRowKey={(row) => row.node_id}
            expandedKey={expandedNodeId}
            onToggle={handleToggleNode}
            renderCells={(node) => (
              <>
                <td className="px-4 py-2">{node.node_type}</td>
                <td className="px-4 py-2">{nodeDisplayLabel(node)}</td>
                <td className="px-4 py-2 font-mono">{truncateId(node.identity_key, 16)}</td>
                <td className="px-4 py-2 font-mono">{truncateId(node.node_id)}</td>
              </>
            )}
            renderDetail={(node) => (
              <NodeDetailPanel
                nodeId={node.node_id}
                cachedNode={node}
                detail={nodeDetail?.node_id === node.node_id ? nodeDetail : null}
                loading={detailLoading === "node" && expandedNodeId === node.node_id}
                error={expandedNodeId === node.node_id ? detailError : ""}
              />
            )}
          />

          <ExpandableTable
            title="Edges"
            columns={["Type", "Scope", "Confidence", "Status", "Edge ID"]}
            rows={sortedEdges}
            getRowKey={(row) => row.edge_id}
            expandedKey={expandedEdgeId}
            onToggle={handleToggleEdge}
            renderCells={(edge) => (
              <>
                <td className="px-4 py-2">{edge.edge_type}</td>
                <td className="px-4 py-2 font-mono">{edge.scope}</td>
                <td className="px-4 py-2">{formatConfidence(edge.confidence)}</td>
                <td className="px-4 py-2">
                  {isVerifiedEdge(edge) ? (
                    <Badge tone="verified">Verified</Badge>
                  ) : (
                    <Badge tone="unverified">Observed</Badge>
                  )}
                </td>
                <td className="px-4 py-2 font-mono">{truncateId(edge.edge_id)}</td>
              </>
            )}
            renderDetail={(edge) => (
              <EdgeDetailPanel
                edgeId={edge.edge_id}
                cachedEdge={edge}
                detail={edgeDetail?.edge_id === edge.edge_id ? edgeDetail : null}
                loading={detailLoading === "edge" && expandedEdgeId === edge.edge_id}
                error={expandedEdgeId === edge.edge_id ? detailError : ""}
                nodesById={nodesById}
              />
            )}
          />
        </>
      )}
    </div>
  );
}
