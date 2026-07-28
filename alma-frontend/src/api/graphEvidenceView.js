/**
 * Evidence-oriented projections from Compatibility Graph subgraphs.
 */
import {
  FRAMEWORK_EDGE_TYPE,
  VERIFIED_EDGE_TYPE,
  findConflictingEvidence,
  isVerifiedEdge,
  nodeDisplayLabel,
} from "./graphModel";

const LAUNCHED_VIA = "launched_via";
const RUNTIME_OBSERVED = "runtime_observed";

function nodesById(subgraph) {
  return Object.fromEntries((subgraph?.nodes || []).map((node) => [node.node_id, node]));
}

function edgesOfType(subgraph, edgeType) {
  return (subgraph?.edges || []).filter((edge) => edge.edge_type === edgeType);
}

function relationshipRows(subgraph) {
  const lookup = nodesById(subgraph);
  return (subgraph?.edges || []).map((edge) => ({
    edgeId: edge.edge_id,
    edgeType: edge.edge_type,
    scope: edge.scope,
    confidence: edge.confidence,
    sourceLabel: nodeDisplayLabel(lookup[edge.source_node_id]),
    targetLabel: nodeDisplayLabel(lookup[edge.target_node_id]),
    verified: isVerifiedEdge(edge),
    provenance: edge.evidence_references || [],
  }));
}

function mappedTargets(subgraph, edgeType, attributeKey) {
  const lookup = nodesById(subgraph);
  return edgesOfType(subgraph, edgeType).map((edge) => {
    const target = lookup[edge.target_node_id];
    return {
      edgeId: edge.edge_id,
      scope: edge.scope,
      confidence: edge.confidence,
      label: nodeDisplayLabel(target),
      value: target?.attributes?.[attributeKey] || target?.identity_key,
      provenance: edge.evidence_references || [],
    };
  });
}

/** Build a read-only evidence summary for Explorer detail panels. */
export function buildEvidenceView(subgraph) {
  const lookup = nodesById(subgraph);
  const applicationNode = (subgraph?.nodes || []).find((node) => node.node_type === "application");
  const sessionNode = (subgraph?.nodes || []).find((node) => node.node_type === "execution_session");
  const verifiedEdges = edgesOfType(subgraph, VERIFIED_EDGE_TYPE);
  const relationships = relationshipRows(subgraph);

  return {
    sessionId: subgraph?.session_id || sessionNode?.identity_key || "",
    applicationFingerprint: subgraph?.application_fingerprint || applicationNode?.identity_key || "",
    applicationIdentity: {
      name: applicationNode ? nodeDisplayLabel(applicationNode) : "",
      fingerprint: applicationNode?.identity_key || subgraph?.application_fingerprint || "",
      filePath: applicationNode?.attributes?.file_path || "",
    },
    verificationStatus: {
      verified: verifiedEdges.length > 0,
      contracts: mappedTargets(subgraph, VERIFIED_EDGE_TYPE, "policy_id"),
    },
    frameworks: mappedTargets(subgraph, FRAMEWORK_EDGE_TYPE, "framework"),
    launchStrategies: mappedTargets(subgraph, LAUNCHED_VIA, "strategy_id"),
    verificationContracts: (subgraph?.nodes || [])
      .filter((node) => node.node_type === "verification_contract")
      .map((node) => ({
        label: nodeDisplayLabel(node),
        policyId: node.attributes?.policy_id,
        policyVersion: node.attributes?.policy_version,
        nodeId: node.node_id,
      })),
    observedRuntimes: mappedTargets(subgraph, RUNTIME_OBSERVED, "kind"),
    nodes: subgraph?.nodes || [],
    edges: subgraph?.edges || [],
    relationships,
    conflicts: findConflictingEvidence(subgraph),
    allEdgesHaveProvenance: relationships.every((row) => row.provenance.length > 0),
  };
}
