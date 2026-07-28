import {
  allFindingsHaveProvenance,
  buildRegressionView,
  regressionSummariesUseFactualLanguage,
  regressionViewAvoidsPrescriptiveLanguage,
} from "./regressionModel";

const sampleReport = {
  application_fingerprint: "fp-1",
  application_name: "Code::Blocks",
  schema_version: "compatibility_regression_v1",
  generated_at: "2026-07-28T12:00:00+00:00",
  comparison_session_id: "session-c",
  baseline_session_count: 3,
  current_session_count: 4,
  unchanged_summary: "",
  findings: [
    {
      regression_id: "reg-1",
      application_fingerprint: "fp-1",
      application_name: "Code::Blocks",
      regression_type: "strategy_success_rate_dropped",
      severity: "warning",
      subject: "wine_gui",
      previous_state: {
        dimension: "launch_strategy_success_rate",
        label: "wine_gui",
        value: "1.0000",
        evidence_references: [{ source_type: "attempt", source_id: "a:1" }],
      },
      current_state: {
        dimension: "launch_strategy_success_rate",
        label: "wine_gui",
        value: "0.7500",
        evidence_references: [{ source_type: "attempt", source_id: "c:1" }],
      },
      first_observed_at: "2026-07-28T11:00:00+00:00",
      comparison_session_id: "session-c",
      baseline_session_ids: ["a", "b", "e"],
      confidence: 0.75,
      summary:
        "Observed verified success rate for wine_gui changed from 100.00% to 75.00% (delta 25.00%).",
      evidence_references: [
        { source_type: "attempt", source_id: "a:1" },
        { source_type: "attempt", source_id: "c:1" },
      ],
    },
    {
      regression_id: "reg-2",
      application_fingerprint: "fp-1",
      application_name: "Code::Blocks",
      regression_type: "framework_changed",
      severity: "info",
      subject: "wxwidgets",
      previous_state: {
        dimension: "framework_evidence",
        label: "wxwidgets",
        value: "observations=2",
        evidence_references: [{ source_type: "framework_detection", source_id: "a:1" }],
      },
      current_state: {
        dimension: "framework_evidence",
        label: "wxwidgets",
        value: "observations=3",
        evidence_references: [{ source_type: "framework_detection", source_id: "c:1" }],
      },
      first_observed_at: "2026-07-28T11:00:00+00:00",
      comparison_session_id: "session-c",
      baseline_session_ids: ["a", "b", "e"],
      confidence: 0.7,
      summary: "Framework evidence changed for wxwidgets.",
      evidence_references: [
        { source_type: "framework_detection", source_id: "a:1" },
        { source_type: "framework_detection", source_id: "c:1" },
      ],
    },
  ],
};

describe("buildRegressionView", () => {
  it("projects findings with before/after provenance", () => {
    const view = buildRegressionView(sampleReport);
    expect(view.findings).toHaveLength(2);
    expect(view.comparisonSessionId).toBe("session-c");
    expect(view.hasFindings).toBe(true);
  });

  it("avoids prescriptive language", () => {
    const view = buildRegressionView(sampleReport);
    expect(regressionViewAvoidsPrescriptiveLanguage(view)).toBe(true);
  });

  it("requires provenance on every finding", () => {
    const view = buildRegressionView(sampleReport);
    expect(allFindingsHaveProvenance(view)).toBe(true);
  });

  it("uses factual summaries for change types", () => {
    const view = buildRegressionView(sampleReport);
    expect(regressionSummariesUseFactualLanguage(view)).toBe(true);
  });
});
