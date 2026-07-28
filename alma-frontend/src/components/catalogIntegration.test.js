jest.mock("../api/catalogClient");

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fetchCatalogApplications } from "../api/catalogClient";
import CompatibilityCatalogPanel from "../components/CompatibilityCatalogPanel";

const sampleCatalog = {
  schema_version: "compatibility_catalog_v1",
  generated_at: "2026-07-28T12:00:00+00:00",
  applications: [
    {
      fingerprint: "codeblocks-sha256-fixture",
      name: "codeblocks.exe",
      total_sessions: 6,
      verified_successes: 4,
      verified_failures: 1,
      latest_status: "mixed_verified",
      latest_session: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      last_regression_change: "Run environment snapshot differs for wine-10.0 (Ubuntu) | Linux (Ubuntu)/x86_64.",
      observed_frameworks: ["wxwidgets"],
      observed_strategies: ["wine_gui"],
      latest_environment_summary: "wine-10.0 (Ubuntu) | Linux (Ubuntu)/x86_64 | prefix:abc123",
    },
  ],
};

function renderCatalog(container) {
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/catalog"]}>
        <Routes>
          <Route path="/catalog" element={<CompatibilityCatalogPanel />} />
        </Routes>
      </MemoryRouter>
    );
  });
  return root;
}

describe("CompatibilityCatalogPanel integration", () => {
  beforeEach(() => {
    fetchCatalogApplications.mockResolvedValue(sampleCatalog);
  });

  it("renders catalog table with environment and explorer action", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    renderCatalog(container);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = container.textContent;
    expect(text).toContain("Compatibility Catalog");
    expect(text).toContain("codeblocks.exe");
    expect(text).toContain("wine-10.0");
    expect(text).toContain("Open Explorer");
    expect(text).toContain("wxwidgets");
    document.body.removeChild(container);
  });
});
