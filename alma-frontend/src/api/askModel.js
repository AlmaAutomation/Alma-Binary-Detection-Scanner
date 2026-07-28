/**
 * Pure helpers for Ask Alma presentation.
 */

export function classifyAskError(err) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  if (status === 404) {
    return {
      kind: "not_found",
      message: typeof detail === "string" ? detail : "No evidence available for this question.",
      errors: [],
    };
  }
  if (status === 422) {
    const message =
      typeof detail === "object" && detail?.message
        ? detail.message
        : "Malformed evidence prevented Ask Alma from answering.";
    const errors = typeof detail === "object" ? detail?.errors || [] : [];
    return { kind: "malformed", message, errors };
  }
  return {
    kind: "error",
    message: err?.message || "Ask Alma request failed.",
    errors: [],
  };
}

export function askRenderStatusLabel(answer) {
  const mode = answer?.render_mode || "deterministic";
  if (mode === "llm") return "AI-rendered from verified Alma evidence";
  if (mode === "deterministic_fallback") return "AI unavailable — deterministic answer shown";
  return "Deterministic";
}

export function buildAskView(answer) {
  if (!answer) return null;
  return {
    question: answer.question,
    questionType: answer.question_type,
    answer: answer.answer,
    confidence: answer.confidence,
    limitations: answer.limitations || [],
    provenance: answer.evidence_references || [],
    renderMode: answer.render_mode || "deterministic",
    fallbackReason: answer.fallback_reason,
    renderStatusLabel: askRenderStatusLabel(answer),
  };
}

export const SUGGESTED_QUESTIONS = [
  "Has this application worked before?",
  "What changed recently?",
  "Which frameworks have been observed?",
  "What launch strategies have succeeded?",
  "What runtime observations exist?",
  "Show conflicting evidence.",
];

export function askViewAvoidsPrescriptiveLanguage(view) {
  const serialized = JSON.stringify(view || {}).toLowerCase();
  const banned = [
    "best strategy",
    "requires vc++",
    "install vc++",
    "you should",
    "alma recommends",
    "fix by",
    "switch to",
  ];
  return !banned.some((phrase) => serialized.includes(phrase));
}
