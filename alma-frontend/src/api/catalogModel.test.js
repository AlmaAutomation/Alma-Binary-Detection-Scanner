import {
  buildCatalogView,
  catalogViewAvoidsExecutionLanguage,
  filterCatalogApplications,
} from "./catalogModel";

const sampleResponse = {
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
      observed_frameworks: ["qt", "wxwidgets"],
      observed_strategies: ["wine_gui"],
      latest_environment_summary: "wine-10.0 (Ubuntu) | Linux (Ubuntu)/x86_64 | prefix:abc123",
    },
    {
      fingerprint: "other-app-fingerprint",
      name: "other.exe",
      total_sessions: 1,
      verified_successes: 0,
      verified_failures: 0,
      latest_status: "unverified_or_failed",
      latest_session: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      last_regression_change: null,
      observed_frameworks: [],
      observed_strategies: [],
      latest_environment_summary: null,
    },
  ],
};

describe("buildCatalogView", () => {
  it("projects catalog rows with explorer links", () => {
    const view = buildCatalogView(sampleResponse);
    expect(view.applications).toHaveLength(2);
    expect(view.applications[0].verifiedHistory).toContain("4 verified success");
    expect(view.applications[0].explorerHref).toContain("codeblocks-sha256-fixture");
    expect(view.applications[0].latestEnvironmentSummary).toContain("wine-10.0");
  });

  it("filters by search and status", () => {
    const view = buildCatalogView(sampleResponse);
    const bySearch = filterCatalogApplications(view.applications, { search: "wine-10" });
    expect(bySearch).toHaveLength(1);
    const byStatus = filterCatalogApplications(view.applications, { status: "unverified" });
    expect(byStatus).toHaveLength(1);
    expect(byStatus[0].name).toBe("other.exe");
  });

  it("avoids execution/remediation language", () => {
    const view = buildCatalogView(sampleResponse);
    expect(catalogViewAvoidsExecutionLanguage(view)).toBe(true);
  });
});
