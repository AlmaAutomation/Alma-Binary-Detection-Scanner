/**
 * Evidence-grounded Ask Alma API.
 */
import bridge from "./bridgeClient";

export async function postAskAlma({
  question,
  applicationFingerprint,
  sessionId = null,
  render = "deterministic",
}) {
  const trimmedQuestion = (question || "").trim();
  const trimmedFingerprint = (applicationFingerprint || "").trim();
  if (!trimmedQuestion) throw new Error("Question is required");
  if (!trimmedFingerprint) throw new Error("Application fingerprint is required");
  const res = await bridge.post("/bridge/ask", {
    question: trimmedQuestion,
    application_fingerprint: trimmedFingerprint,
    session_id: sessionId,
    render,
  });
  return res.data;
}
