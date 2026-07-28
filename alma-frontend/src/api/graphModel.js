/**
 * Pure helpers for Compatibility Graph subgraph presentation.
 * Kept separate from axios calls for unit testing.
 */

export const VERIFIED_EDGE_TYPE = "verified_by";
export const FRAMEWORK_EDGE_TYPE = "detected_framework";

/** @typedef {import('./graphClient').GraphSubgraph} GraphSubgraph */
/** @typedef {import('./graphClient').GraphNode} GraphNode */
/** @typedef {import('./graphClient').GraphEdge} GraphEdge */

export function nodeDisplayLabel(node) {
  if (!node) return "";
  const attrs = node.attributes || {};
  switch (node.node_type) {
    case "application":
      return attrs.file_path || node.identity_key;
    case "framework":
      return attrs.framework || node.identity_key;
    case "launch_strategy":
      return attrs.strategy_id || node.identity_key;
    case "verification_contract":
      return `${attrs.policy_id || "?"}@${attrs.policy_version || "?"}`;
    case "execution_session":
      return node.identity_key;
    case "prefix_manifest":
      return (node.identity_key || "").slice(0, 16) + "…";
    case "runtime":
      return `${attrs.kind || "runtime"} ${attrs.version_family || ""}`.trim();
    case "evidence_record":
      return attrs.artifact_key || node.identity_key;
    default:
      return node.identity_key || node.node_id;
  }
}

export function isVerifiedEdge(edge) {
  return edge?.edge_type === VERIFIED_EDGE_TYPE;
}

export function countByField(items, field) {
  return (items || []).reduce((acc, item) => {
    const key = item[field] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function summarizeSubgraph(subgraph) {
  const nodes = subgraph?.nodes || [];
  const edges = subgraph?.edges || [];
  const verifiedEdges = edges.filter(isVerifiedEdge);
  const frameworkEdges = edges.filter((e) => e.edge_type === FRAMEWORK_EDGE_TYPE);

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodesByType: countByField(nodes, "node_type"),
    edgesByType: countByField(edges, "edge_type"),
    verifiedEdgeCount: verifiedEdges.length,
    hasVerifiedLaunch: verifiedEdges.length > 0,
    frameworkObservationCount: frameworkEdges.length,
    engineVersion: subgraph?.engine_version || "",
    schemaVersion: subgraph?.schema_version || "",
    ingestedAt: subgraph?.ingested_at || "",
  };
}

/**
 * Conflicting evidence: multiple framework detections for the same session
 * pointing at different framework nodes, or multiple distinct frameworks
 * observed within one session scope prefix.
 */
export function findConflictingEvidence(subgraph) {
  const edges = subgraph?.edges || [];
  const nodesById = Object.fromEntries((subgraph?.nodes || []).map((n) => [n.node_id, n]));
  const frameworkEdges = edges.filter((e) => e.edge_type === FRAMEWORK_EDGE_TYPE);

  /** @type {Map<string, { scopes: Set<string>, targets: Set<string>, edges: GraphEdge[] }>} */
  const bySession = new Map();

  for (const edge of frameworkEdges) {
    const scope = edge.scope || "";
    const sessionPrefix = scope.includes(":") ? scope.split(":")[0] : scope;
    if (!bySession.has(sessionPrefix)) {
      bySession.set(sessionPrefix, { scopes: new Set(), targets: new Set(), edges: [] });
    }
    const bucket = bySession.get(sessionPrefix);
    bucket.scopes.add(scope);
    bucket.targets.add(edge.target_node_id);
    bucket.edges.push(edge);
  }

  const conflicts = [];
  for (const [sessionId, bucket] of bySession.entries()) {
    if (bucket.targets.size <= 1) continue;
    const frameworks = [...bucket.targets].map((id) => {
      const node = nodesById[id];
      return node ? nodeDisplayLabel(node) : id.slice(0, 12);
    });
    conflicts.push({
      kind: "framework",
      sessionId,
      scopes: [...bucket.scopes],
      frameworks,
      edgeCount: bucket.edges.length,
      message: `Session ${sessionId} has ${bucket.targets.size} distinct framework observations: ${frameworks.join(", ")}`,
    });
  }

  const verifiedBySession = edges
    .filter(isVerifiedEdge)
    .map((e) => e.scope?.split(":")?.[0])
    .filter(Boolean);
  const launchedScopes = new Set(
    edges.filter((e) => e.edge_type === "launched_via").map((e) => e.scope)
  );
  for (const sessionId of new Set(verifiedBySession)) {
    const hasLaunch = [...launchedScopes].some((s) => s.startsWith(sessionId));
    if (!hasLaunch) {
      conflicts.push({
        kind: "incomplete",
        sessionId,
        message: `Session ${sessionId} has verified_by edge but no launched_via attempt edge in subgraph`,
      });
    }
  }

  return conflicts;
}

export function classifyGraphError(err) {
  const status = err?.response?.status;
  if (status === 404) {
    return { kind: "not_found", message: "No graph evidence found for this query." };
  }
  if (status === 422) {
    const detail = err?.response?.data?.detail;
    const message =
      typeof detail === "object" && detail?.message
        ? detail.message
        : "Graph evidence is malformed and could not be ingested.";
    const errors = typeof detail === "object" && Array.isArray(detail?.errors) ? detail.errors : [];
    return { kind: "malformed", message, errors };
  }
  const message = err?.response?.data?.detail || err?.message || "Graph request failed.";
  return { kind: "error", message: typeof message === "string" ? message : "Graph request failed." };
}

export function truncateId(id, len = 12) {
  if (!id) return "";
  if (id.length <= len * 2 + 1) return id;
  return `${id.slice(0, len)}…${id.slice(-len)}`;
}

export function formatConfidence(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Math.round(Number(value) * 100)}%`;
}

export function sortNodes(nodes) {
  return [...(nodes || [])].sort((a, b) => {
    const ta = a.node_type || "";
    const tb = b.node_type || "";
    if (ta !== tb) return ta.localeCompare(tb);
    return nodeDisplayLabel(a).localeCompare(nodeDisplayLabel(b));
  });
}

export function sortEdges(edges) {
  return [...(edges || [])].sort((a, b) => {
    const ta = a.edge_type || "";
    const tb = b.edge_type || "";
    if (ta !== tb) return ta.localeCompare(tb);
    return (a.scope || "").localeCompare(b.scope || "");
  });
}
