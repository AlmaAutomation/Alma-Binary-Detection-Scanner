jest.mock("../api/recentSessionsClient");
jest.mock("../api/graphClient");
jest.mock("../api/advisorClient");

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fetchApplicationGraph } from "../api/graphClient";
import { fetchApplicationAdvisor } from "../api/advisorClient";
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
  render_mode: "deterministic",
  fallback_reason: null,
  summary: "Deterministic summary.",
  limitations: [],
  observations: [
    {
      observation_id: "obs-1",
      category: "strategy_history",
      title: "Launch strategy history",
      statement: "wine_gui was used in 4 attempt(s).",
      confidence: 0.8,
      severity: "info",
      source_layer: "knowledge",
      evidence_references: [{ source_type: "attempt", source_id: "a:1" }],
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

describe("Advisor LLM rendering Explorer integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchApplicationGraph.mockResolvedValue(sampleGraph);
    fetchApplicationAdvisor.mockResolvedValue(sampleAdvisor);
  });

  it("defaults to deterministic advisor rendering", async () => {
    renderExplorer();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchApplicationAdvisor).toHaveBeenCalledWith(
      "fp-1",
      null,
      "deterministic"
    );
  });

  it("requests llm rendering when AI wording is toggled", async () => {
    const container = renderExplorer();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const toggle = container.querySelector('input[type="checkbox"]');
    await act(async () => {
      toggle.click();
    });
    expect(fetchApplicationAdvisor).toHaveBeenLastCalledWith("fp-1", null, "llm");
  });

  it("shows fallback status when AI unavailable", async () => {
    fetchApplicationAdvisor.mockResolvedValue({
      ...sampleAdvisor,
      render_mode: "deterministic_fallback",
      fallback_reason: "provider_unavailable",
    });
    const container = renderExplorer();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain(
      "AI unavailable — deterministic explanation shown"
    );
  });
});
