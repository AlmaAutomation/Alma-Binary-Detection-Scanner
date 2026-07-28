jest.mock("../api/recentSessionsClient");
jest.mock("../api/graphClient");
jest.mock("../api/knowledgeClient");
jest.mock("../api/regressionClient");

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fetchApplicationGraph } from "../api/graphClient";
import { fetchApplicationRegression } from "../api/regressionClient";
import CompatibilityExplorerPanel from "../components/CompatibilityExplorerPanel";

const sampleRegression = {
  application_fingerprint: "fp-1",
  application_name: "Code::Blocks",
  schema_version: "compatibility_regression_v1",
  generated_at: "2026-07-28T12:00:00+00:00",
  comparison_session_id: "33333333-3333-4333-8333-333333333333",
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
      comparison_session_id: "33333333-3333-4333-8333-333333333333",
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
      regression_type: "verified_success_to_verified_failure",
      severity: "critical",
      subject: "application_verified_outcome",
      previous_state: {
        dimension: "verified_outcome",
        label: "verified failures",
        value: "0",
        evidence_references: [{ source_type: "attempt", source_id: "a:1" }],
      },
      current_state: {
        dimension: "verified_outcome",
        label: "verified failures",
        value: "1",
        evidence_references: [{ source_type: "attempt", source_id: "c:1" }],
      },
      first_observed_at: "2026-07-28T11:00:00+00:00",
      comparison_session_id: "33333333-3333-4333-8333-333333333333",
      baseline_session_ids: ["a", "b", "e"],
      confidence: 0.9,
      summary:
        "Compatibility regression: verified failure observed where baseline had no verified failures.",
      evidence_references: [
        { source_type: "attempt", source_id: "a:1" },
        { source_type: "attempt", source_id: "c:1" },
      ],
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

describe("Compatibility Regression Explorer integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchApplicationGraph.mockResolvedValue({
      schema_version: "compatibility_graph_v1",
      application_fingerprint: "fp-1",
      nodes: [],
      edges: [],
    });
    fetchApplicationRegression.mockResolvedValue(sampleRegression);
  });

  it("renders regression findings with provenance via deep link", async () => {
    const container = document.createElement("div");
    const unmount = renderExplorer(container, ["/explorer?fingerprint=fp-1&view=regressions"]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Compatibility Regression Comparison");
    expect(container.textContent).toContain("wine_gui");
    expect(container.textContent).toContain("Observed verified success rate");
    expect(container.textContent).toContain("Compatibility regression");
    expect(container.textContent).toContain("Show before/after evidence");
    expect(container.textContent.toLowerCase()).not.toContain("application is broken");
    expect(container.textContent.toLowerCase()).not.toContain("best strategy");
    expect(container.textContent.toLowerCase()).not.toContain("alma recommends");
    unmount();
  });

  it("shows session banner when regressions exist on graph tab", async () => {
    const container = document.createElement("div");
    const unmount = renderExplorer(container, ["/explorer?fingerprint=fp-1"]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("regression finding(s)");
    unmount();
  });
});
