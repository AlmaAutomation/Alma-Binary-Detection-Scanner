/**
 * Read-only Compatibility Regression API (/bridge/regression/*).
 */
import bridge from "./bridgeClient";

export async function fetchApplicationRegression(fingerprint, sessionId) {
  const trimmed = (fingerprint || "").trim();
  if (!trimmed) throw new Error("Application fingerprint is required");
  const params = sessionId ? { session_id: sessionId } : undefined;
  const res = await bridge.get(
    `/bridge/regression/applications/${encodeURIComponent(trimmed)}`,
    { params }
  );
  return res.data;
}

export async function fetchSessionRegression(sessionId) {
  const trimmed = (sessionId || "").trim();
  if (!trimmed) throw new Error("Session ID is required");
  const res = await bridge.get(`/bridge/regression/sessions/${encodeURIComponent(trimmed)}`);
  return res.data;
}
