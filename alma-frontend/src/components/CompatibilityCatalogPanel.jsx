import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchCatalogApplications } from "../api/catalogClient";
import {
  buildCatalogView,
  classifyCatalogError,
  filterCatalogApplications,
} from "../api/catalogModel";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "verified_success", label: "Verified success" },
  { id: "verified_failure", label: "Verified failure" },
  { id: "mixed", label: "Mixed verified" },
  { id: "unverified", label: "Unverified" },
];

function StateBanner({ tone, title, message }) {
  const tones = {
    loading: "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-100",
    empty: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
    error: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.empty}`}>
      <div className="font-medium">{title}</div>
      {message ? <div className="text-sm mt-1 opacity-90">{message}</div> : null}
    </div>
  );
}

function StatusBadge({ label }) {
  const normalized = (label || "").toLowerCase();
  let tone = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
  if (normalized.includes("verified success")) {
    tone = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
  } else if (normalized.includes("verified failure")) {
    tone = "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200";
  } else if (normalized.includes("mixed")) {
    tone = "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

export default function CompatibilityCatalogPanel() {
  const [loading, setLoading] = useState(true);
  const [viewState, setViewState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [catalogView, setCatalogView] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setViewState("loading");
    setErrorMessage("");
    try {
      const data = await fetchCatalogApplications();
      setCatalogView(buildCatalogView(data));
      setViewState("success");
    } catch (err) {
      const classified = classifyCatalogError(err);
      setViewState(classified.kind);
      setErrorMessage(classified.message);
      setCatalogView(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const filteredRows = useMemo(() => {
    if (!catalogView?.applications) return [];
    return filterCatalogApplications(catalogView.applications, {
      search,
      status: statusFilter,
    });
  }, [catalogView, search, statusFilter]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Compatibility Catalog
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Read-only application history, environment evidence, and regression changes.
            </p>
          </div>
          <button
            type="button"
            onClick={loadCatalog}
            disabled={loading}
            className="px-3 py-1.5 rounded-md text-sm bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
          >
            Refresh
          </button>
        </div>
      </div>

      {viewState === "loading" ? (
        <StateBanner tone="loading" title="Loading catalog…" />
      ) : null}

      {viewState === "not_found" ? (
        <StateBanner tone="empty" title="No applications yet" message={errorMessage} />
      ) : null}

      {viewState === "error" || viewState === "malformed" ? (
        <StateBanner tone="error" title="Catalog unavailable" message={errorMessage} />
      ) : null}

      {viewState === "success" ? (
        <>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search applications, frameworks, environment…"
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-1">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setStatusFilter(filter.id)}
                    className={`px-2.5 py-1 rounded-full text-xs border ${
                      statusFilter === filter.id
                        ? "bg-teal-600 text-white border-teal-600"
                        : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Showing {filteredRows.length} of {catalogView.applications.length} application
              {catalogView.applications.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Application</th>
                    <th className="px-4 py-3">Verified history</th>
                    <th className="px-4 py-3">Last run</th>
                    <th className="px-4 py-3">Last change</th>
                    <th className="px-4 py-3">Framework</th>
                    <th className="px-4 py-3">Strategy</th>
                    <th className="px-4 py-3">Environment</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                        No applications match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.fingerprint}
                        className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50/80 dark:hover:bg-gray-900/40"
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{row.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 break-all">
                            {row.fingerprint}
                          </div>
                          <div className="mt-1">
                            <StatusBadge label={row.latestStatusLabel} />
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">{row.verifiedHistory}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-mono text-xs break-all">{row.latestSession || "—"}</div>
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          {row.lastRegressionChange || "No recorded change"}
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          {(row.observedFrameworks || []).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          {(row.observedStrategies || []).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          {row.latestEnvironmentSummary || "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Link
                            to={row.explorerHref}
                            className="inline-flex px-2.5 py-1 rounded-md text-xs font-medium bg-teal-600 text-white hover:bg-teal-700"
                          >
                            Open Explorer
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
