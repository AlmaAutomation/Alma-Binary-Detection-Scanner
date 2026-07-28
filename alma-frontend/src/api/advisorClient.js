/**
 * Read-only Compatibility Advisor API (/bridge/advisor/*).
 */
import bridge from "./bridgeClient";

export async function fetchApplicationAdvisor(fingerprint, sessionId, render = "deterministic") {
  const trimmed = (fingerprint || "").trim();
  if (!trimmed) throw new Error("Application fingerprint is required");
  const params = { render };
  if (sessionId) params.session_id = sessionId;
  const res = await bridge.get(
    `/bridge/advisor/applications/${encodeURIComponent(trimmed)}`,
    { params }
  );
  return res.data;
}

export async function fetchSessionAdvisor(sessionId, render = "deterministic") {
  const trimmed = (sessionId || "").trim();
  if (!trimmed) throw new Error("Session ID is required");
  const res = await bridge.get(`/bridge/advisor/sessions/${encodeURIComponent(trimmed)}`, {
    params: { render },
  });
  return res.data;
}
