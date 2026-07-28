/**
 * Read-only recent Bridge sessions for Compatibility Explorer.
 */
import bridge from "./bridgeClient";

export async function fetchRecentSessions(limit = 20) {
  const res = await bridge.get("/bridge/sessions/recent", { params: { limit } });
  return res.data;
}
