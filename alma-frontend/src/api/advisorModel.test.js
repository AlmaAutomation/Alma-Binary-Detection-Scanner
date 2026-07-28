import {
  advisorViewAvoidsPrescriptiveLanguage,
  allObservationsHaveProvenance,
  buildAdvisorView,
} from "./advisorModel";

const sampleExplanation = {
  application_fingerprint: "fp-1",
  application_name: "Code::Blocks",
  schema_version: "compatibility_advisor_v1",
  engine_version: "compatibility_advisor_deterministic_v1",
  generated_at: "2026-07-28T12:00:00+00:00",
  summary:
    "Code::Blocks has multiple authoritatively verified sessions using wine_gui. A later verified failure was observed after prior verified successes.",
  limitations: ["Alma does not infer a runtime requirement from these observations."],
  observations: [
    {
      observation_id: "obs-1",
      category: "verified_outcome_history",
      title: "Verified outcome history",
      statement: "Three prior sessions were authoritatively verified successful using wine_gui.",
      confidence: 0.9,
      severity: "info",
      source_layer: "knowledge",
      evidence_references: [{ source_type: "verification", source_id: "a:1" }],
    },
    {
      observation_id: "obs-2",
      category: "conflicting_evidence",
      title: "Conflicting framework evidence",
      statement: "Framework evidence is conflicting: wxwidgets and qt have both been observed.",
      confidence: 0.85,
      severity: "warning",
      source_layer: "knowledge",
      evidence_references: [
        { source_type: "framework_detection", source_id: "a:1" },
        { source_type: "framework_detection", source_id: "d:1" },
      ],
    },
  ],
};

describe("advisorModel", () => {
  it("builds grouped advisor view", () => {
    const view = buildAdvisorView(sampleExplanation);
    expect(view.summary).toContain("verified");
    expect(view.groupedObservations.verified_outcome_history).toHaveLength(1);
    expect(view.groupedObservations.conflicting_evidence).toHaveLength(1);
  });

  it("avoids prescriptive language", () => {
    const view = buildAdvisorView(sampleExplanation);
    expect(advisorViewAvoidsPrescriptiveLanguage(view)).toBe(true);
  });

  it("requires provenance on observations", () => {
    const view = buildAdvisorView(sampleExplanation);
    expect(allObservationsHaveProvenance(view)).toBe(true);
  });
});
