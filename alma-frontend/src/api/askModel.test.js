import {
  askRenderStatusLabel,
  askViewAvoidsPrescriptiveLanguage,
  buildAskView,
  classifyAskError,
} from "./askModel";

const sampleAnswer = {
  question: "Has wine_gui worked before?",
  question_type: "launch_strategy_history",
  answer:
    "Yes. wine_gui has 6 authoritatively verified successes across 7 observed outcomes for this application.",
  confidence: 0.95,
  evidence_references: [
    {
      source_layer: "knowledge",
      source_type: "verification",
      source_id: "a:1",
      session_id: "sess-a",
      attempt_id: 1,
    },
  ],
  limitations: [],
  render_mode: "deterministic",
};

describe("askModel", () => {
  it("builds ask view with provenance", () => {
    const view = buildAskView(sampleAnswer);
    expect(view.answer).toContain("wine_gui");
    expect(view.provenance).toHaveLength(1);
    expect(view.questionType).toBe("launch_strategy_history");
  });

  it("avoids prescriptive language", () => {
    const view = buildAskView(sampleAnswer);
    expect(askViewAvoidsPrescriptiveLanguage(view)).toBe(true);
  });

  it("maps render status labels", () => {
    expect(askRenderStatusLabel({ render_mode: "deterministic" })).toBe("Deterministic");
    expect(askRenderStatusLabel({ render_mode: "llm" })).toBe(
      "AI-rendered from verified Alma evidence"
    );
    expect(askRenderStatusLabel({ render_mode: "deterministic_fallback" })).toBe(
      "AI unavailable — deterministic answer shown"
    );
  });

  it("classifies malformed evidence errors", () => {
    const classified = classifyAskError({
      response: {
        status: 422,
        data: { detail: { message: "Malformed evidence prevented Ask Alma from answering." } },
      },
    });
    expect(classified.kind).toBe("malformed");
  });
});
