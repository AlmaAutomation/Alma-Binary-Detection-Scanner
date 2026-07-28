/**
 * Read-only Compatibility Knowledge API (/bridge/knowledge/*).
 */
import bridge from "./bridgeClient";

export async function fetchApplicationKnowledge(fingerprint) {
  const trimmed = (fingerprint || "").trim();
  if (!trimmed) throw new Error("Application fingerprint is required");
  const res = await bridge.get(
    `/bridge/knowledge/applications/${encodeURIComponent(trimmed)}`
  );
  return res.data;
}
