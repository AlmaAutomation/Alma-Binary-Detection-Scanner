// src/components/AlmaScanDashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";

// Resolve API base in this order: Vite env → CRA env → current site origin.
// Works in dev and when the backend serves the built UI at /app.
// Resolve API base in this order: Vite env → CRA env → current site origin.
// Works in dev and when the backend serves the built UI at /app.
const API_BASE = window.location.origin;

// One axios instance for the whole app
const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains("dark")
  );
  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  };
  return (
    <button
      onClick={toggle}
      className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
      title="Toggle dark mode"
    >
      {isDark ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}

export default function AlmaScanDashboard() {
  // Restore saved theme
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark") document.documentElement.classList.add("dark");
      if (saved === "light") document.documentElement.classList.remove("dark");
    } catch {}
  }, []);

  // Inputs
  const [scanPath, setScanPath] = useState("/usr/bin");
  const [archFilter, setArchFilter] = useState("all");
  const [resultLimit, setResultLimit] = useState(200);

  // Data
  const [systemInfo, setSystemInfo] = useState(null);
  const [binaries, setBinaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);

  // Client-side search + sort state
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("path"); // 'architecture' | 'path' | 'file'
  const [sortDir, setSortDir] = useState("asc");  // 'asc' | 'desc'

  // Counters for the UI
  const [binaryCount, setBinaryCount] = useState(0);
  const [totalSeen, setTotalSeen] = useState(null); // reserved for future backend

  // Debounce the folder input so we don’t fire scans on each keystroke
  const debouncedScanPath = useDebounce(scanPath, 300);

  // ---- Persist scan inputs (load once) ----
  useEffect(() => {
    try {
      const sp = localStorage.getItem("alma.scanPath");
      const af = localStorage.getItem("alma.archFilter");
      const rl = localStorage.getItem("alma.resultLimit");
      if (sp) setScanPath(sp);
      if (["all", "32-bit", "64-bit", "unknown"].includes(af || "")) setArchFilter(af);
      const n = rl ? parseInt(rl, 10) : NaN;
      if (!Number.isNaN(n) && n > 0) setResultLimit(n);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Persist scan inputs (save on change) ----
  useEffect(() => {
    try {
      localStorage.setItem("alma.scanPath", scanPath);
      localStorage.setItem("alma.archFilter", archFilter);
      localStorage.setItem("alma.resultLimit", String(resultLimit));
    } catch {}
  }, [scanPath, archFilter, resultLimit]);

  // ---- Persist search & sort (load once) ----
  useEffect(() => {
    try {
      const q  = localStorage.getItem("alma.query");
      const sk = localStorage.getItem("alma.sortKey");
      const sd = localStorage.getItem("alma.sortDir");
      if (q !== null) setQuery(q);
      if (["architecture", "path", "file"].includes(sk || "")) setSortKey(sk);
      if (["asc", "desc"].includes(sd || "")) setSortDir(sd);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Persist search & sort (save on change) ----
  useEffect(() => {
    try {
      localStorage.setItem("alma.query",   query);
      localStorage.setItem("alma.sortKey", sortKey);
      localStorage.setItem("alma.sortDir", sortDir);
    } catch {}
  }, [query, sortKey, sortDir]);

  useEffect(() => {
    fetchMetrics();
    fetchCacheInfo();
  }, []);

  const hydrateFromResult = (data) => {
    setSystemInfo(data.system_info);
    const list = data.binaries || [];
    setBinaries(list);
    setBinaryCount(
      typeof data.binary_count === "number" ? data.binary_count : list.length
    );
    setTotalSeen(typeof data.total_seen === "number" ? data.total_seen : null);
  };

  const fetchScan = useCallback(async () => {
    if (!debouncedScanPath) return;
    setLoading(true);
    setBinaries([]);
    setSystemInfo(null);
    try {
      const res = await api.get("/scan", {
        params: {
          folder: debouncedScanPath,
          arch_filter: archFilter.toLowerCase(),
          limit: resultLimit,
        },
      });
      hydrateFromResult(res.data);
      fetchMetrics();
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedScanPath, archFilter, resultLimit]);

  // NEW: run scan immediately for a chosen architecture (used by clickable chips)
  const runScanWithArch = useCallback(
    async (targetArch) => {
      if (!debouncedScanPath) return;
      setLoading(true);
      // reset client-side filters so the user sees the raw set for that arch
      setQuery("");
      setSortKey("path");
      setSortDir("asc");
      try {
        const res = await api.get("/scan", {
          params: {
            folder: debouncedScanPath,
            arch_filter: targetArch.toLowerCase(),
            limit: resultLimit,
          },
        });
        hydrateFromResult(res.data);
        setArchFilter(targetArch); // reflect selection in the dropdown
        fetchMetrics();
      } catch (err) {
        console.error("Scan error:", err);
      } finally {
        setLoading(false);
      }
    },
    [debouncedScanPath, resultLimit]
  );

  const fetchMetrics = async () => {
    try {
      const res = await api.get("/metrics");
      setMetrics(res.data);
    } catch {}
  };

  const fetchCacheInfo = async () => {
    try {
      const res = await api.get("/cache");
      setCacheInfo(res.data);
    } catch {}
  };

  const clearCache = async () => {
    try {
      await api.delete("/cache");
      await fetchCacheInfo();
    } catch {}
  };

  // ===== Client-side filter + sort =====
  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? binaries.filter((b) => {
          const arch = (b.architecture || "").toString().toLowerCase();
          const file = (b.file || "").toString().toLowerCase();
          const path = (b.path || "").toString().toLowerCase();
          return arch.includes(q) || file.includes(q) || path.includes(q);
        })
      : binaries;

    const sorted = [...filtered].sort((a, b) => {
      const av = (a[sortKey] || "").toString().toLowerCase();
      const bv = (b[sortKey] || "").toString().toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [binaries, query, sortKey, sortDir]);

  // Architecture chips (counts over current table)
  const archSummary = useMemo(() => {
    let a64 = 0, a32 = 0, unk = 0;
    for (const b of filteredAndSorted) {
      if (b.architecture === "64-bit") a64++;
      else if (b.architecture === "32-bit") a32++;
      else unk++;
    }
    return { a64, a32, unk, total: filteredAndSorted.length };
  }, [filteredAndSorted]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Reset filters (search + sort)
  const resetFilters = () => {
    setQuery("");
    setSortKey("path");
    setSortDir("asc");
    try {
      localStorage.removeItem("alma.query");
      localStorage.setItem("alma.sortKey", "path");
      localStorage.setItem("alma.sortDir", "asc");
    } catch {}
  };

  // ===== Export helpers =====
  const downloadBlob = (content, filename, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a);
    a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      scan_path: scanPath,
      filter: archFilter,
      limit: resultLimit,
      system_info: systemInfo,
      metrics,
      binary_count: filteredAndSorted.length,
      binaries: filteredAndSorted,
    };
    downloadBlob(JSON.stringify(payload, null, 2),
      `alma-scan-${Date.now()}.json`, "application/json");
  };

  const escapeCSV = (v) => {
    if (v == null) return "";
    const s = String(v);
    return (s.includes('"') || s.includes(",") || s.includes("\n"))
      ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const exportCSV = () => {
    const meta = [
      `# Alma Scan Export`,
      `# exported_at,${new Date().toISOString()}`,
      `# scan_path,${scanPath}`,
      `# filter,${archFilter}`,
      `# limit,${resultLimit}`,
      metrics ? `# metrics,precision:${metrics.precision}|recall:${metrics.recall}|f1:${metrics.f1}` : `# metrics,na`,
      `# binary_count,${filteredAndSorted.length}`,
      query ? `# filter_query,${query}` : ``,
      sortKey ? `# sort,${sortKey}:${sortDir}` : ``,
    ].filter(Boolean).join("\n");

    const header = "architecture,file,path";
    const rows = filteredAndSorted.map(b => [
      escapeCSV(b.architecture),
      escapeCSV(b.file || (b.path ? b.path.split("/").pop() : "")),
      escapeCSV(b.path),
    ].join(","));

    downloadBlob([meta, header, ...rows].join("\n"),
      `alma-scan-${Date.now()}.csv`, "text/csv;charset=utf-8");
  };

  // ===== UI =====
  const SortHeader = ({ label, col }) => (
    <button
      onClick={() => toggleSort(col)}
      className="flex items-center gap-1 group"
      title={`Sort by ${label}`}
    >
      <span className="group-hover:underline">{label}</span>
      <span className="text-xs opacity-60">
        {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );

  // chip styles (inactive vs active)
  const chipBase = "px-2 py-1 rounded text-xs font-semibold border transition";
  const active = "opacity-100";
  const inactive = "opacity-75 hover:opacity-100";

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-8">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Alma Scanner</h1>
          <ThemeToggle />
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
          <h2 className="text-lg font-semibold mb-4">🔍 Run Binary Scan</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">Folder to scan</span>
              <input
                type="text"
                value={scanPath}
                onChange={(e) => setScanPath(e.target.value)}
                className="mt-1 w-full p-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="/usr/bin"
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">Architecture filter</span>
              <select
                value={archFilter}
                onChange={(e) => setArchFilter(e.target.value)}
                className="mt-1 w-full p-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All</option>
                <option value="32-bit">32-bit</option>
                <option value="64-bit">64-bit</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">Result limit</span>
              <input
                type="number"
                min={1}
                value={resultLimit}
                onChange={(e) => setResultLimit(parseInt(e.target.value || "0", 10))}
                className="mt-1 w-full p-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="200"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={fetchScan}
              disabled={loading || !scanPath}
              className={`px-4 py-2 rounded-lg text-white font-medium transition ${
                loading ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {loading ? "Scanning…" : "Run Scan"}
            </button>

            {systemInfo && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {systemInfo.os} · {systemInfo.architecture} · {systemInfo.cpu_cores} cores
              </span>
            )}
          </div>

          {(binaryCount > 0 || totalSeen != null) && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Results: <span className="font-semibold">{binaryCount}</span>
              {totalSeen != null && (
                <> from <span className="font-semibold">{totalSeen}</span> scanned</>
              )}
            </div>
          )}
        </div>

        {/* Metrics & System Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
            <h3 className="text-md font-semibold mb-3">📈 Scan Metrics</h3>
            {metrics ? (
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/70">
                  <div className="text-gray-500 dark:text-gray-400">Precision</div>
                  <div className="text-lg font-semibold">{metrics.precision}</div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/70">
                  <div className="text-gray-500 dark:text-gray-400">Recall</div>
                  <div className="text-lg font-semibold">{metrics.recall}</div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/70">
                  <div className="text-gray-500 dark:text-gray-400">F1 Score</div>
                  <div className="text-lg font-semibold">{metrics.f1}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">No metrics yet.</div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
            <h3 className="text-md font-semibold mb-3">🖥️ System Info</h3>
            {systemInfo ? (
              <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                <li><span className="text-gray-500 dark:text-gray-400">OS:</span> {systemInfo.os} {systemInfo.os_version}</li>
                <li><span className="text-gray-500 dark:text-gray-400">Arch:</span> {systemInfo.architecture} · {systemInfo.machine}</li>
                <li><span className="text-gray-500 dark:text-gray-400">CPU:</span> {systemInfo.cpu} · {systemInfo.cpu_cores} cores</li>
                {systemInfo.ram_total_mb && (<li><span className="text-gray-500 dark:text-gray-400">RAM:</span> {systemInfo.ram_total_mb} MB</li>)}
                {systemInfo.distribution && (<li><span className="text-gray-500 dark:text-gray-400">Distribution:</span> {systemInfo.distribution}</li>)}
              </ul>
            ) : (
              <div className="text-sm text-gray-500">Run a scan to load system info.</div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-md font-semibold">📁 Detected Binaries</h3>

            {/* Search + summary + export */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Arch summary chips (CLICKABLE) */}
              <div className="flex items-center gap-1 mr-2 text-xs">
                <button
                  onClick={() => runScanWithArch("64-bit")}
                  className={`${chipBase} ${archFilter === "64-bit" ? active : inactive} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-transparent`}
                  title="Show only 64-bit binaries"
                >
                  64-bit: {archSummary.a64}
                </button>
                <button
                  onClick={() => runScanWithArch("32-bit")}
                  className={`${chipBase} ${archFilter === "32-bit" ? active : inactive} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-transparent`}
                  title="Show only 32-bit binaries"
                >
                  32-bit: {archSummary.a32}
                </button>
                <button
                  onClick={() => runScanWithArch("unknown")}
                  className={`${chipBase} ${archFilter === "unknown" ? active : inactive} bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-transparent`}
                  title="Show only unknown architecture binaries"
                >
                  unknown: {archSummary.unk}
                </button>
                <button
                  onClick={() => runScanWithArch("all")}
                  className={`${chipBase} ${archFilter === "all" ? active : inactive} bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border-transparent`}
                  title="Show all architectures"
                >
                  total: {archSummary.total}
                </button>
              </div>

              {/* Quick search */}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by path/file/arch…"
                className="px-2 py-1 border rounded-lg text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ minWidth: 220 }}
              />

              {/* Reset filters */}
              <button
                onClick={resetFilters}
                className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Clear search and restore default sort"
              >
                Reset filters
              </button>

              <button onClick={exportJSON} className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs hover:bg-slate-800">
                Export JSON
              </button>
              <button onClick={exportCSV} className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs hover:bg-slate-800">
                Export CSV
              </button>
            </div>
          </div>

          {filteredAndSorted.length === 0 ? (
            <div className="text-sm text-gray-500">
              {binaries.length === 0
                ? <>No binaries yet. Choose a folder and click <strong>Run Scan</strong>.</>
                : <>No results match your filter.</>}
            </div>
          ) : (
            <div className="overflow-hidden ring-1 ring-gray-200/60 dark:ring-gray-800/60 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/70">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">
                      <SortHeader label="Architecture" col="architecture" />
                    </th>
                    <th className="px-4 py-2 text-left font-medium">
                      <SortHeader label="Path" col="path" />
                    </th>
                    <th className="px-4 py-2 text-left font-medium">
                      <SortHeader label="File" col="file" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredAndSorted.map((b, i) => (
                    <tr key={i} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                            b.architecture === "64-bit"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : b.architecture === "32-bit"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                              : b.architecture === "unknown"
                              ? "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                              : "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {b.architecture}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs truncate max-w-[520px]" title={b.path}>
                        {b.path}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs truncate max-w-[260px]" title={b.file}>
                        {b.file || (b.path ? b.path.split("/").pop() : "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cache */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
          <h3 className="text-md font-semibold mb-2">🧠 Cache</h3>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Cached entries: {cacheInfo?.count ?? 0}
            </p>
            <button
              onClick={clearCache}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm"
            >
              Clear Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}