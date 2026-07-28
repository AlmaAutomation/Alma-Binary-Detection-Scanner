import {
  allAggregatesHaveProvenance,
  buildKnowledgeView,
  conflictsPreserveAllSides,
  knowledgeViewAvoidsRequiredLanguage,
} from "./knowledgeModel";

const sampleProfile = {
  application_fingerprint: "codeblocks-sha256-fixture",
  application_name: "codeblocks.exe",
  schema_version: "compatibility_knowledge_v1",
  generated_at: "2026-07-28T12:00:00+00:00",
  total_sessions: 4,
  verified_successes: 2,
  verified_failures: 1,
  unverifiable_sessions: 1,
  observed_frameworks: [
    {
      framework: "wxwidgets",
      observation_count: 3,
      verified_session_count: 2,
      confidence: 0.75,
      classification: "conflicting",
      evidence_references: [{ source_type: "framework_detection", source_id: "a:1" }],
    },
    {
      framework: "qt",
      observation_count: 1,
      verified_session_count: 0,
      confidence: 0.75,
      classification: "conflicting",
      evidence_references: [{ source_type: "framework_detection", source_id: "d:1" }],
    },
  ],
  observed_launch_strategies: [
    {
      strategy: "wine_gui",
      attempts: 4,
      verified_successes: 2,
      verified_failures: 1,
      success_rate: 0.6667,
      evidence_references: [{ source_type: "attempt", source_id: "a:1" }],
    },
  ],
  verification_contracts: [
    {
      contract: "wine_gui_process_v1:1.1.0:wine_gui:process_survives",
      passed_count: 2,
      failed_count: 1,
      evidence_references: [{ source_type: "verification", source_id: "a:1" }],
    },
  ],
  observed_runtimes: [
    {
      runtime: "wine",
      observation_count: 4,
      verified_success_observation_count: 2,
      evidence_references: [{ source_type: "attempt", source_id: "a:1" }],
    },
  ],
  conflicts: [
    {
      relationship: "detected_framework",
      conflict_type: "competing_framework_observations",
      competing_observations: ["wxwidgets", "qt"],
      evidence_by_side: {
        wxwidgets: [{ source_type: "framework_detection", source_id: "a:1" }],
        qt: [{ source_type: "framework_detection", source_id: "d:1" }],
      },
    },
  ],
};

describe("buildKnowledgeView", () => {
  it("projects aggregate sections with provenance", () => {
    const view = buildKnowledgeView(sampleProfile);
    expect(view.frameworks).toHaveLength(2);
    expect(view.strategies[0].verifiedSuccesses).toBe(2);
    expect(view.conflicts[0].competing).toEqual(["wxwidgets", "qt"]);
  });

  it("avoids required-language in serialized view", () => {
    const view = buildKnowledgeView(sampleProfile);
    expect(knowledgeViewAvoidsRequiredLanguage(view)).toBe(true);
  });

  it("preserves conflicts without picking a winner", () => {
    const view = buildKnowledgeView(sampleProfile);
    expect(conflictsPreserveAllSides(view)).toBe(true);
  });

  it("requires provenance on every aggregate row", () => {
    const view = buildKnowledgeView(sampleProfile);
    expect(allAggregatesHaveProvenance(view)).toBe(true);
  });
});
