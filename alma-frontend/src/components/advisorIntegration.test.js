jest.mock("../api/recentSessionsClient");
jest.mock("../api/graphClient");
jest.mock("../api/advisorClient");

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fetchApplicationGraph } from "../api/graphClient";
import { fetchApplicationAdvisor } from "../api/advisorClient";
import {
  advisorViewAvoidsPrescriptiveLanguage,
  allObservationsHaveProvenance,
} from "../api/advisorModel";
import CompatibilityExplorerPanel from "../components/CompatibilityExplorerPanel";

const sampleGraph = {
  application_fingerprint: "fp-1",
  session_id: null,
  nodes: [{ node_id: "n1", node_type: "application", identity_key: "fp-1", attributes: {} }],
  edges: [],
};

const sampleAdvisor = {
  application_fingerprint: "fp-1",
  application_name: "Code::Blocks",
  schema_version: "compatibility_advisor_v1",
  summary:
    "Code::Blocks has multiple authoritatively verified sessions using wine_gui. wxWidgets and qt appear in conflicting framework evidence.",
  limitations: ["Alma does not infer a runtime requirement from these observations."],
  observations: [
    {
      observation_id: "obs-1",
      category: "strategy_history",
      title: "Launch strategy history",
      statement: "wine_gui was used in 4 attempt(s) with 2 authoritative verified success(es).",
      confidence: 0.8,
      severity: "info",
      source_layer: "knowledge",
      evidence_references: [{ source_type: "attempt", source_id: "a:1", session_id: "sess-a" }],
    },
    {
      observation_id: "obs-2",
      category: "conflicting_evidence",
      title: "Conflicting framework evidence",
      statement: "Framework evidence is conflicting: wxwidgets and qt have both been observed.",
      confidence: 0.85,
      severity: "warning",
      source_layer: "knowledge",
      evidence_references: [{ source_type: "framework_detection", source_id: "d:1" }],
    },
  ],
};

function renderExplorer(initialEntry = "/explorer?fingerprint=fp-1&view=advisor") {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/explorer" element={<CompatibilityExplorerPanel />} />
        </Routes>
      </MemoryRouter>
    );
  });
  return container;
}

describe("Compatibility Advisor Explorer integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchApplicationGraph.mockResolvedValue(sampleGraph);
    fetchApplicationAdvisor.mockResolvedValue(sampleAdvisor);
  });

  it("loads advisor tab from deep link", async () => {
    const container = renderExplorer();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchApplicationAdvisor).toHaveBeenCalled();
    expect(container.textContent).toContain("Compatibility Advisor");
    expect(container.textContent).toContain("wine_gui");
  });

  it("renders observations with provenance controls", async () => {
    const container = renderExplorer();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("View evidence");
    const view = {
      summary: sampleAdvisor.summary,
      observations: sampleAdvisor.observations.map((obs) => ({
        ...obs,
        provenance: obs.evidence_references,
      })),
    };
    expect(allObservationsHaveProvenance(view)).toBe(true);
    expect(advisorViewAvoidsPrescriptiveLanguage({ summary: sampleAdvisor.summary })).toBe(true);
  });

  it("does not render forbidden recommendation language", async () => {
    const container = renderExplorer();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const text = container.textContent.toLowerCase();
    expect(text).not.toContain("best strategy");
    expect(text).not.toContain("requires vc++");
    expect(text).not.toContain("alma recommends");
  });
});
