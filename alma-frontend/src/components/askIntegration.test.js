jest.mock("../api/recentSessionsClient");
jest.mock("../api/graphClient");
jest.mock("../api/askClient");

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fetchApplicationGraph } from "../api/graphClient";
import { postAskAlma } from "../api/askClient";
import { askViewAvoidsPrescriptiveLanguage, buildAskView } from "../api/askModel";
import CompatibilityExplorerPanel from "../components/CompatibilityExplorerPanel";

const sampleGraph = {
  application_fingerprint: "fp-1",
  session_id: null,
  nodes: [
    {
      node_id: "n1",
      node_type: "application",
      identity_key: "fp-1",
      attributes: { file_path: "/opt/CodeBlocks/codeblocks" },
    },
  ],
  edges: [],
};

const sampleAskAnswer = {
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

function renderExplorer(initialEntry = "/explorer?fingerprint=fp-1&view=ask") {
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

describe("Compatibility Ask Alma Explorer integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchApplicationGraph.mockResolvedValue(sampleGraph);
    postAskAlma.mockResolvedValue(sampleAskAnswer);
  });

  it("loads ask tab from deep link", async () => {
    const container = renderExplorer();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Ask Alma");
    expect(container.textContent).toContain("Ask Alma about");
  });

  it("submits scoped ask question with provenance", async () => {
    const container = renderExplorer();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const suggested = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("Has this application worked before?")
    );
    await act(async () => {
      suggested.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(postAskAlma).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "Has this application worked before?",
        applicationFingerprint: "fp-1",
        render: "deterministic",
      })
    );
    expect(container.textContent).toContain("wine_gui");
    expect(container.textContent).toContain("View evidence");
    const view = buildAskView(sampleAskAnswer);
    expect(view.provenance).toHaveLength(1);
    expect(askViewAvoidsPrescriptiveLanguage(view)).toBe(true);
  });

  it("does not render forbidden recommendation language", async () => {
    postAskAlma.mockResolvedValue({
      ...sampleAskAnswer,
      question: "Should I install VC++?",
      question_type: "runtime_observations",
      answer:
        "Alma has observed VC++ runtime evidence in 2 sessions but does not infer installation requirements.",
    });
    const container = renderExplorer();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const suggested = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("Has this application worked before?")
    );
    await act(async () => {
      suggested.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    const text = container.textContent.toLowerCase();
    expect(text).not.toContain("best strategy");
    expect(text).not.toContain("install vc++");
    expect(text).not.toContain("alma recommends");
  });
});
