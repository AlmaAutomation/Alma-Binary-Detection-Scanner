/**
 * Read-only Compatibility Graph API (/bridge/graph/*).
 */
import bridge from "./bridgeClient";

export async function fetchApplicationGraph(fingerprint) {
  const trimmed = (fingerprint || "").trim();
  if (!trimmed) throw new Error("Application fingerprint is required");
  const res = await bridge.get(
    `/bridge/graph/applications/${encodeURIComponent(trimmed)}`
  );
  return res.data;
}

export async function fetchSessionGraph(sessionId) {
  const trimmed = (sessionId || "").trim();
  if (!trimmed) throw new Error("Session ID is required");
  const res = await bridge.get(`/bridge/graph/sessions/${encodeURIComponent(trimmed)}`);
  return res.data;
}

export async function fetchGraphNode(nodeId) {
  const trimmed = (nodeId || "").trim();
  if (!trimmed) throw new Error("Node ID is required");
  const res = await bridge.get(`/bridge/graph/nodes/${encodeURIComponent(trimmed)}`);
  return res.data;
}

export async function fetchGraphEdge(edgeId) {
  const trimmed = (edgeId || "").trim();
  if (!trimmed) throw new Error("Edge ID is required");
  const res = await bridge.get(`/bridge/graph/edges/${encodeURIComponent(trimmed)}`);
  return res.data;
}
