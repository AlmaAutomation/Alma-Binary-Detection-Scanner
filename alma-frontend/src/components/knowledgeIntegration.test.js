jest.mock("../api/recentSessionsClient");
jest.mock("../api/graphClient");
jest.mock("../api/knowledgeClient");

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fetchApplicationGraph } from "../api/graphClient";
import { fetchApplicationKnowledge } from "../api/knowledgeClient";
import CompatibilityExplorerPanel from "../components/CompatibilityExplorerPanel";

const sampleKnowledge = {
  application_fingerprint: "fp-1",
  application_name: "Code::Blocks",
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
  verification_contracts: [],
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

function renderExplorer(container, initialEntries = ["/explorer"]) {
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/explorer" element={<CompatibilityExplorerPanel />} />
        </Routes>
      </MemoryRouter>
    );
  });
  return () =>
    act(() => {
      root.unmount();
    });
}

describe("Compatibility Knowledge Explorer integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchApplicationGraph.mockResolvedValue({
      schema_version: "compatibility_graph_v1",
      application_fingerprint: "fp-1",
      nodes: [],
      edges: [],
    });
    fetchApplicationKnowledge.mockResolvedValue(sampleKnowledge);
  });

  it("renders knowledge aggregates with provenance and conflict sides", async () => {
    const container = document.createElement("div");
    const unmount = renderExplorer(container, ["/explorer?fingerprint=fp-1&view=knowledge"]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Compatibility Knowledge");
    expect(container.textContent).toContain("wxwidgets");
    expect(container.textContent).toContain("qt");
    expect(container.textContent).toContain("framework_detection:a:1");
    expect(container.textContent).toContain("Competing detected_framework observations");
    expect(container.textContent.toLowerCase()).not.toContain("best strategy");
    expect(container.textContent.toLowerCase()).not.toContain("required framework");
    unmount();
  });
});
