// src/components/AIB_AlmaScanDashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";

// When the app is served by FastAPI at :9000, this will be http://localhost:9000
const API_BASE = window.location.origin;

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

function truthyLabel(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

function scorePercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function verdictBadgeClass(verdict) {
  switch (verdict) {
    case "compatible":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "compatible_with_changes":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    case "remote_only":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300";
    case "incompatible_local":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  }
}

function strategyBadgeClass(name) {
  switch (name) {
    case "native":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "remote_execute":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300";
    case "containerize":
    case "compat_layer":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    case "emulate":
    case "vm":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
    case "rebuild":
    case "reject":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
  }
}

// Simple local risk estimator from telemetry (advisory only)
function computeRiskFromTelemetry(snapshot) {
  if (!snapshot) return null;

  const cpu = typeof snapshot.cpu === "number" ? snapshot.cpu : 0;
  const mem =
    typeof snapshot.memory?.percent === "number" ? snapshot.memory.percent : 0;
  const zombies = snapshot.processes?.zombie_processes || 0;

  let score = Math.max(cpu, mem);
  if (zombies > 0) score += 10;
  if (score > 100) score = 100;

  let band = "low";
  if (score >= 80) band = "critical";
  else if (score >= 60) band = "high";
  else if (score >= 30) band = "elevated";

  return { band, score };
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains("dark")
  );
  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      onClick={toggle}
      className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
      title="Toggle dark mode"
    >
      {isDark ? "Dark" : "Light"}
    </button>
  );
}

export default function AIB_AlmaScanDashboard() {
  // Restore saved theme
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark") document.documentElement.classList.add("dark");
      if (saved === "light") document.documentElement.classList.remove("dark");
    } catch {}
  }, []);

  // ===== Scan inputs =====
  const [scanPath, setScanPath] = useState("/usr/bin");
  const [archFilter, setArchFilter] = useState("all");
  const [resultLimit, setResultLimit] = useState(200);
  const [forensicMode, setForensicMode] = useState(false);

  // ===== Data from backend =====
  const [systemInfo, setSystemInfo] = useState(null);
  const [binaries, setBinaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);

  // ===== Alma Core evaluation =====
  const [coreEval, setCoreEval] = useState(null); // full /core/evaluate response
  const [coreCapabilities, setCoreCapabilities] = useState(null);
  const [coreLoading, setCoreLoading] = useState(false);
  const [coreError, setCoreError] = useState(null);

  // Client-side search + sort state
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("path"); // 'architecture' | 'path' | 'file'
  const [sortDir, setSortDir] = useState("asc"); // 'asc' | 'desc'

  // Counters for the UI
  const [binaryCount, setBinaryCount] = useState(0);
  const [totalSeen, setTotalSeen] = useState(null); // reserved for future backend

  // Debounced folder for scans
  const debouncedScanPath = useDebounce(scanPath, 300);

  // Analysis state
  const [Analysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // ===== EWS (Early Warning System) state =====
  const [ewsSnapshot, setEwsSnapshot] = useState(null);
  const [ewsProfile, setEwsProfile] = useState("lab");
  const [ewsRisk, setEwsRisk] = useState(null);

  // Authorization UI state
  const [authStatus, setAuthStatus] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  // ---- Persist scan inputs (load once) ----
  useEffect(() => {
    try {
      const sp = localStorage.getItem("alma.scanPath");
      const af = localStorage.getItem("alma.archFilter");
      const rl = localStorage.getItem("alma.resultLimit");
      const fm = localStorage.getItem("alma.forensicMode");

      if (sp) setScanPath(sp);
      if (["all", "32-bit", "64-bit", "unknown"].includes(af || ""))
        setArchFilter(af);

      const n = rl ? parseInt(rl, 10) : NaN;
      if (!Number.isNaN(n) && n > 0) setResultLimit(n);

      if (fm === "true") setForensicMode(true);
    } catch {}
  }, []);

  // ---- Persist scan inputs (save on change) ----
  useEffect(() => {
    try {
      localStorage.setItem("alma.scanPath", scanPath);
      localStorage.setItem("alma.archFilter", archFilter);
      localStorage.setItem("alma.resultLimit", String(resultLimit));
      localStorage.setItem("alma.forensicMode", forensicMode ? "true" : "false");
    } catch {}
  }, [scanPath, archFilter, resultLimit, forensicMode]);

  // ---- Persist search & sort (load once) ----
  useEffect(() => {
    try {
      const q = localStorage.getItem("alma.query");
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
      localStorage.setItem("alma.query", query);
      localStorage.setItem("alma.sortKey", sortKey);
      localStorage.setItem("alma.sortDir", sortDir);
    } catch {}
  }, [query, sortKey, sortDir]);

  const hydrateFromResult = (data) => {
    setSystemInfo(data.system_info);
    const list = data.binaries || [];
    setBinaries(list);
    setBinaryCount(
      typeof data.binary_count === "number" ? data.binary_count : list.length
    );
    setTotalSeen(typeof data.total_seen === "number" ? data.total_seen : null);
  };

  // --- Load metrics + cache info once ---
  useEffect(() => {
    fetchMetrics();
    fetchCacheInfo();
    fetchCoreCapabilities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const fetchCoreCapabilities = async () => {
    try {
      const res = await api.get("/core/capabilities");
      setCoreCapabilities(res.data);
    } catch {
      setCoreCapabilities(null);
    }
  };

  const clearCache = async () => {
    try {
      await api.delete("/cache");
      await fetchCacheInfo();
    } catch {}
  };

  // ===== Alma Core: Insight scan -> Core evaluate =====
  const runCoreEvaluate = useCallback(
    async ({ folder, arch_filter, limit, forensic }) => {
      setCoreLoading(true);
      setCoreError(null);
      try {
        // 1) Get InsightScanResult
        const insightRes = await api.post("/insight/scan", {
          folder,
          arch_filter,
          limit,
          forensic,
        });

        // 2) Evaluate with Alma Core
        const [evalRes, capsRes] = await Promise.all([
          api.post("/core/evaluate", insightRes.data),
          api.get("/core/capabilities").catch(() => ({ data: null })),
        ]);

        setCoreEval(evalRes.data);
        setCoreCapabilities(capsRes?.data || null);
      } catch (err) {
        console.error("Core evaluate error:", err);
        setCoreError("Core evaluation failed. Check backend logs.");
        setCoreEval(null);
      } finally {
        setCoreLoading(false);
      }
    },
    []
  );

  // ===== EWS Polling (telemetry + policy profile) =====
  useEffect(() => {
    let cancelled = false;

    const fetchEwsProfile = async () => {
      try {
        const res = await api.get("/api/ews/profile");
        if (!cancelled) setEwsProfile(res.data?.profile || "lab");
      } catch {}
    };

    const fetchEwsTelemetry = async () => {
      try {
        const res = await api.get("/api/ews/telemetry");
        if (!cancelled) {
          const snap = res.data || null;
          setEwsSnapshot(snap);
          setEwsRisk(snap ? computeRiskFromTelemetry(snap) : null);
        }
      } catch {
        if (!cancelled) {
          setEwsSnapshot(null);
          setEwsRisk(null);
        }
      }
    };

    fetchEwsProfile();
    fetchEwsTelemetry();

    const id = setInterval(fetchEwsTelemetry, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // ===== Authorization handler (advisory only) =====
  const handleAuthorize = useCallback(async () => {
    setAuthStatus(null);

    if (!ewsSnapshot) {
      setAuthStatus(
        "No telemetry available yet. Wait for Alma EWS to collect a snapshot."
      );
      return;
    }

    const risk = ewsRisk || computeRiskFromTelemetry(ewsSnapshot);
    if (!risk) {
      setAuthStatus("Unable to compute risk from telemetry.");
      return;
    }

    setAuthLoading(true);
    try {
      const res = await api.post("/api/ews/authorize", {
        risk_band: risk.band,
        risk_score: risk.score,
      });
      setAuthStatus(res.data?.detail || "Authorization sent in advisory mode.");
    } catch (err) {
      console.error("EWS authorize error:", err);
      setAuthStatus(
        "Authorization request failed. Check backend logs for details."
      );
    } finally {
      setAuthLoading(false);
    }
  }, [ewsSnapshot, ewsRisk]);

  // ===== Base scan =====
  const fetchScan = useCallback(async () => {
    if (!debouncedScanPath) return;

    setLoading(true);
    setBinaries([]);
    setSystemInfo(null);
    setAiAnalysis(null);
    setAiError(null);
    setCoreEval(null);
    setCoreError(null);

    try {
      const res = await api.get("/scan", {
        params: {
          folder: debouncedScanPath,
          arch_filter: archFilter.toLowerCase(),
          limit: resultLimit,
          forensic: forensicMode,
        },
      });

      hydrateFromResult(res.data);

      // After scan, also compute Core eval from Insight
      await runCoreEvaluate({
        folder: debouncedScanPath,
        arch_filter: archFilter.toLowerCase(),
        limit: resultLimit,
        forensic: forensicMode,
      });

      fetchMetrics();
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedScanPath,
    archFilter,
    resultLimit,
    forensicMode,
    runCoreEvaluate,
  ]);

  // ===== Scan + analysis =====
  const runAiScan = useCallback(async () => {
    if (!scanPath) return;

    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    setLoading(true);
    setCoreEval(null);
    setCoreError(null);

    try {
      const res = await api.post("/ai/scan_and_analyze", {
        folder: scanPath,
        arch_filter: archFilter.toLowerCase(),
        limit: resultLimit,
        forensic: forensicMode,
      });

      const { scan, summary, ai_analysis } = res.data || {};
      if (scan) {
        hydrateFromResult(scan);

        // After scan, also compute Core eval from Insight
        await runCoreEvaluate({
          folder: scanPath,
          arch_filter: archFilter.toLowerCase(),
          limit: resultLimit,
          forensic: forensicMode,
        });

        fetchMetrics();
      }

      if (summary || ai_analysis) {
        setAiAnalysis({
          text: ai_analysis || "",
          summary: summary || null,
        });
      }
    } catch (err) {
      console.error("AI scan error:", err);
      setAiError("AI analysis failed. Check backend logs.");
    } finally {
      setAiLoading(false);
      setLoading(false);
    }
  }, [scanPath, archFilter, resultLimit, forensicMode, runCoreEvaluate]);

  // ===== architecture chips (run scan immediately for selected arch) =====
  const runScanWithArch = useCallback(
    async (targetArch) => {
      if (!debouncedScanPath) return;

      setLoading(true);
      setAiAnalysis(null);
      setAiError(null);
      setCoreEval(null);
      setCoreError(null);

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
            forensic: forensicMode,
          },
        });

        hydrateFromResult(res.data);
        setArchFilter(targetArch);
        fetchMetrics();

        // After scan, also compute Core eval from Insight
        await runCoreEvaluate({
          folder: debouncedScanPath,
          arch_filter: targetArch.toLowerCase(),
          limit: resultLimit,
          forensic: forensicMode,
        });
      } catch (err) {
        console.error("Scan error:", err);
      } finally {
        setLoading(false);
      }
    },
    [debouncedScanPath, resultLimit, forensicMode, runCoreEvaluate]
  );

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

  // Architecture summary over current table
  const archSummary = useMemo(() => {
    let a64 = 0,
      a32 = 0,
      unk = 0;
    for (const b of filteredAndSorted) {
      if (b.architecture === "64-bit") a64++;
      else if (b.architecture === "32-bit") a32++;
      else unk++;
    }
    return { a64, a32, unk, total: filteredAndSorted.length };
  }, [filteredAndSorted]);


  const coreBinaryMap = useMemo(() => {
    const map = new Map();
    for (const report of coreEval?.binaries || []) {
      if (report?.path) map.set(report.path, report);
    }
    return map;
  }, [coreEval]);

  const filteredCoreRows = useMemo(() => {
    return filteredAndSorted.map((b) => ({
      binary: b,
      report: coreBinaryMap.get(b.path) || null,
    }));
  }, [filteredAndSorted, coreBinaryMap]);

  const verdictCounts = useMemo(() => {
    const counts = {};
    for (const report of coreEval?.binaries || []) {
      const key = report?.verdict || "unknown";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [coreEval]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

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
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
      analysis: Analysis,
      core_evaluation: coreEval,
    };
    downloadBlob(
      JSON.stringify(payload, null, 2),
      `alma-insight-${Date.now()}.json`,
      "application/json"
    );
  };

  const escapeCSV = (v) => {
    if (v == null) return "";
    const s = String(v);
    return s.includes('"') || s.includes(",") || s.includes("\n")
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };

  const exportCSV = () => {
    const meta = [
      `# Alma Insight Export (EWS/Analysis)`,
      `# exported_at,${new Date().toISOString()}`,
      `# scan_path,${scanPath}`,
      `# filter,${archFilter}`,
      `# limit,${resultLimit}`,
      `# forensic,${forensicMode ? "true" : "false"}`,
      metrics
        ? `# metrics,precision:${metrics.precision}|recall:${metrics.recall}|f1:${metrics.f1}`
        : `# metrics,na`,
      `# binary_count,${filteredAndSorted.length}`,
      query ? `# filter_query,${query}` : ``,
      sortKey ? `# sort,${sortKey}:${sortDir}` : ``,
      Analysis
        ? `# analysis_risk_level,${Analysis.summary?.risk_level || "unknown"}`
        : ``,
    ]
      .filter(Boolean)
      .join("\n");

    const header = "architecture,file,path";
    const rows = filteredAndSorted.map((b) =>
      [
        escapeCSV(b.architecture),
        escapeCSV(b.file || (b.path ? b.path.split("/").pop() : "")),
        escapeCSV(b.path),
      ].join(",")
    );

    downloadBlob(
      [meta, header, ...rows].join("\n"),
      `alma-insight-${Date.now()}.csv`,
      "text/csv;charset=utf-8"
    );
  };

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

  const chipBase = "px-2 py-1 rounded text-xs font-semibold border transition";
  const active = "opacity-100";
  const inactive = "opacity-75 hover:opacity-100";

  const riskPillClass =
    ewsRisk?.band === "critical"
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
      : ewsRisk?.band === "high"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
      : ewsRisk?.band === "elevated"
      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-200"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200";

  const StrategyCountsCard = ({ data }) => {
    const counts = data?.recommended_counts || {};
    const rows = Object.entries(counts).sort(
      (a, b) => (b[1] ?? 0) - (a[1] ?? 0)
    );

    if (!rows.length) {

  return (
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-md font-semibold">Strategy Mix</h3>
            {coreLoading && (
              <span className="text-xs opacity-70">Evaluating…</span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            Run a scan to compute strategy recommendations.
          </div>
          {coreError && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-300">
              {coreError}
            </div>
          )}
        </div>
      );
    }

  return (
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-md font-semibold">Strategy Mix</h3>
          {coreLoading && (
            <span className="text-xs opacity-70">Evaluating…</span>
          )}
        </div>
        <div className="space-y-1 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="opacity-80">{k}</span>
              <span className="font-mono">{v}</span>
            </div>
          ))}
        </div>
        {coreError && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-300">
            {coreError}
          </div>
        )}
      </div>
    );
  };

  const InterpreterCountsCard = ({ data }) => {
    const counts = data?.interpreter_counts || {};
    const rows = Object.entries(counts).sort(
      (a, b) => (b[1] ?? 0) - (a[1] ?? 0)
    );

    if (!rows.length) {

  return (
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-md font-semibold">Interpreter Mix</h3>
            {coreLoading && (
              <span className="text-xs opacity-70">Evaluating…</span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            Run a scan to compute interpreter breakdown.
          </div>
          {coreError && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-300">
              {coreError}
            </div>
          )}
        </div>
      );
    }

  return (
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-md font-semibold">Interpreter Mix</h3>
          {coreLoading && (
            <span className="text-xs opacity-70">Evaluating…</span>
          )}
        </div>
        <div className="space-y-1 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="opacity-80">{k}</span>
              <span className="font-mono">{v}</span>
            </div>
          ))}
        </div>
        {coreError && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-300">
            {coreError}
          </div>
        )}
      </div>
    );
  };



const VerdictCountsCard = ({ data }) => {
  const rows = Object.entries(verdictCounts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-md font-semibold">Compatibility Verdicts</h3>
        {coreLoading && <span className="text-xs opacity-70">Evaluating…</span>}
      </div>
      {rows.length ? (
        <div className="space-y-1 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className={`px-2 py-1 rounded text-xs font-semibold ${verdictBadgeClass(k)}`}>{k}</span>
              <span className="font-mono">{v}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500">Run a scan to compute compatibility verdicts.</div>
      )}
    </div>
  );
};

const HostCapabilitiesCard = ({ data }) => {
  const rows = [
    ["OS bitness", data?.os_bitness || "unknown"],
    ["CPU arch", data?.cpu_arch_normalized || "unknown"],
    ["CPU supports 64-bit", truthyLabel(data?.cpu_supports_64bit)],
    ["Multiarch available", truthyLabel(data?.multiarch_available)],
    ["Wine", truthyLabel(data?.wine_available)],
    ["QEMU user", truthyLabel(data?.qemu_user_available)],
    ["QEMU system", truthyLabel(data?.qemu_system_available)],
    ["Docker", truthyLabel(data?.docker_available)],
    ["Podman", truthyLabel(data?.podman_available)],
  ];

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-semibold">Host Capabilities</h3>
        {coreLoading && <span className="text-xs opacity-70">Refreshing…</span>}
      </div>
      {data ? (
        <div className="space-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-gray-500 dark:text-gray-400">{label}</span>
              <span className="font-mono text-right">{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500">Capabilities endpoint not available yet.</div>
      )}
    </div>
  );
};

const CoreSummaryCard = ({ data }) => {
  const count = data?.evaluated_count || 0;
  const topStrategy = Object.entries(data?.recommended_counts || {}).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
      <h3 className="text-md font-semibold mb-3">Bridge Summary</h3>
      {data ? (
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Evaluated binaries</span>
            <span className="font-mono">{count}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Top strategy</span>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${strategyBadgeClass(topStrategy?.[0])}`}>{topStrategy?.[0] || "—"}</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Use the detailed table below to inspect verdicts, blockers, remediation, and execution paths per binary.
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500">Run a scan to populate Alma Core output.</div>
      )}
    </div>
  );
};

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-8">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            Alma Insight –{" "}
            <span className="text-emerald-600 dark:text-emerald-300">
              EWS + Analysis
            </span>
          </h1>
          <ThemeToggle />
        </div>

        {/* EWS Panel */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-semibold">Alma Early Warning System</h3>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                Policy: {ewsProfile}
              </span>
              {ewsRisk && (
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${riskPillClass}`}
                >
                  Risk: {ewsRisk.band} ({Math.round(ewsRisk.score)})
                </span>
              )}
            </div>
          </div>

          {!ewsSnapshot ? (
            <div className="text-sm text-gray-500">Waiting for telemetry…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/70">
                  <div className="text-gray-500 dark:text-gray-400">CPU</div>
                  <div className="text-lg font-semibold">
                    {typeof ewsSnapshot.cpu === "number"
                      ? ewsSnapshot.cpu.toFixed(1)
                      : "0.0"}
                    %
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/70">
                  <div className="text-gray-500 dark:text-gray-400">Memory</div>
                  <div className="text-lg font-semibold">
                    {typeof ewsSnapshot.memory?.percent === "number"
                      ? ewsSnapshot.memory.percent.toFixed(1)
                      : "0.0"}
                    %
                  </div>
                  <div className="text-xs opacity-70">
                    {Math.round(ewsSnapshot.memory?.used_mb || 0)} /{" "}
                    {Math.round(ewsSnapshot.memory?.total_mb || 0)} MB
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/70">
                  <div className="text-gray-500 dark:text-gray-400">
                    Processes
                  </div>
                  <div>Total: {ewsSnapshot.processes?.total_processes}</div>
                  <div className="text-red-400">
                    Zombies: {ewsSnapshot.processes?.zombie_processes}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/70">
                  <div className="text-gray-500 dark:text-gray-400">
                    Disk I/O
                  </div>
                  <div>R: {ewsSnapshot.disk?.read_mb ?? 0} MB</div>
                  <div>W: {ewsSnapshot.disk?.write_mb ?? 0} MB</div>
                </div>

                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/70">
                  <div className="text-gray-500 dark:text-gray-400">Network</div>
                  <div>
                    TX: {ewsSnapshot.network?.sent_mb?.toFixed?.(1) ?? "0.0"} MB
                  </div>
                  <div>
                    RX: {ewsSnapshot.network?.recv_mb?.toFixed?.(1) ?? "0.0"} MB
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/70">
                  <div className="text-gray-500 dark:text-gray-400">
                    Last Update
                  </div>
                  <div className="text-xs">
                    {ewsSnapshot.timestamp
                      ? new Date(ewsSnapshot.timestamp).toLocaleTimeString()
                      : "N/A"}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Advisory mode: Alma monitors and recommends actions. You
                  approve. No automatic remediation is executed.
                </div>
                <button
                  onClick={handleAuthorize}
                  disabled={authLoading || !ewsSnapshot}
                  className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition ${
                    authLoading || !ewsSnapshot
                      ? "bg-amber-400 cursor-not-allowed"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {authLoading ? "Authorizing…" : "Authorize Recommended Actions"}
                </button>
              </div>

              {authStatus && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                  {authStatus}
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
          <h2 className="text-lg font-semibold mb-4">Run Binary Scan</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Folder to scan
              </span>
              <input
                type="text"
                value={scanPath}
                onChange={(e) => setScanPath(e.target.value)}
                className="mt-1 w-full p-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="/usr/bin"
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Architecture filter
              </span>
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
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Result limit
              </span>
              <input
                type="number"
                min={1}
                value={resultLimit}
                onChange={(e) =>
                  setResultLimit(parseInt(e.target.value || "0", 10))
                }
                className="mt-1 w-full p-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="200"
              />
            </label>
          </div>

          {/* Forensic mode toggle */}
          <div className="mt-3 flex items-center">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={forensicMode}
                onChange={(e) => setForensicMode(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-700"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Forensic mode (recursive, no cache – may be slower)
              </span>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={fetchScan}
              disabled={loading || !scanPath}
              className={`px-4 py-2 rounded-lg text-white font-medium transition ${
                loading && !aiLoading
                  ? "bg-indigo-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {loading && !aiLoading ? "Scanning…" : "Run Scan"}
            </button>

            <button
              onClick={runAiScan}
              disabled={aiLoading || loading || !scanPath}
              className={`px-4 py-2 rounded-lg text-white font-medium transition ${
                aiLoading
                  ? "bg-emerald-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {aiLoading ? "Analyzing…" : "Scan + Analysis"}
            </button>

            {systemInfo && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {systemInfo.os} · {systemInfo.architecture} ·{" "}
                {systemInfo.cpu_cores} cores
              </span>
            )}
          </div>

          {(binaryCount > 0 || totalSeen != null) && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Results: <span className="font-semibold">{binaryCount}</span>
              {totalSeen != null && (
                <>
                  {" "}
                  from <span className="font-semibold">{totalSeen}</span> scanned
                </>
              )}
            </div>
          )}
        </div>

        {/* AI panel */}
        {(Analysis || aiError) && (
          <div
            className={`p-5 rounded-2xl border shadow-sm ${
              aiError
                ? "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800/70"
                : "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/70"
            }`}
          >
            <h3 className="text-sm font-semibold mb-2">
              {aiError ? "Analysis Error" : "Risk Summary (Offline)"}
            </h3>
            {aiError ? (
              <p className="text-sm text-red-700 dark:text-red-300">{aiError}</p>
            ) : (
              <>
                {Analysis?.summary && (
                  <p className="text-sm text-gray-800 dark:text-gray-100 mb-2">
                    <strong>Summary:</strong> {Analysis.summary.summary}{" "}
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                      Risk: {Analysis.summary.risk_level}
                    </span>
                  </p>
                )}
                {Analysis?.text && (
                  <pre className="text-xs whitespace-pre-wrap text-gray-800 dark:text-gray-100 bg-white/70 dark:bg-black/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/50 max-h-80 overflow-auto">
                    {Analysis.text}
                  </pre>
                )}
              </>
            )}
          </div>
        )}

        {/* Core Eval + Metrics + System Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <StrategyCountsCard data={coreEval} />
          <InterpreterCountsCard data={coreEval} />
          <VerdictCountsCard data={coreEval} />

          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
            <h3 className="text-md font-semibold mb-3">Scan Metrics</h3>
            {metrics ? (
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/70">
                  <div className="text-gray-500 dark:text-gray-400">
                    Precision
                  </div>
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

          <HostCapabilitiesCard data={coreCapabilities} />

          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
            <h3 className="text-md font-semibold mb-3">System Info</h3>
            {systemInfo ? (
              <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                <li>
                  <span className="text-gray-500 dark:text-gray-400">OS:</span>{" "}
                  {systemInfo.os} {systemInfo.os_version}
                </li>
                <li>
                  <span className="text-gray-500 dark:text-gray-400">Arch:</span>{" "}
                  {systemInfo.architecture} · {systemInfo.machine}
                </li>
                <li>
                  <span className="text-gray-500 dark:text-gray-400">CPU:</span>{" "}
                  {systemInfo.cpu} · {systemInfo.cpu_cores} cores
                </li>
                {systemInfo.ram_total_mb && (
                  <li>
                    <span className="text-gray-500 dark:text-gray-400">RAM:</span>{" "}
                    {systemInfo.ram_total_mb} MB
                  </li>
                )}
                {systemInfo.distribution && (
                  <li>
                    <span className="text-gray-500 dark:text-gray-400">
                      Distribution:
                    </span>{" "}
                    {systemInfo.distribution}
                  </li>
                )}
              </ul>
            ) : (
              <div className="text-sm text-gray-500">
                Run a scan to load system info.
              </div>
            )}
          </div>
          <CoreSummaryCard data={coreEval} />
        </div>

        {/* Results */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow border border-gray-200/50 dark:border-gray-800/60">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-md font-semibold">Detected Binaries + Bridge Verdicts</h3>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="flex items-center gap-1 mr-2 text-xs">
                <button
                  onClick={() => runScanWithArch("64-bit")}
                  className={`${chipBase} ${
                    archFilter === "64-bit" ? active : inactive
                  } bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-transparent`}
                  title="Show only 64-bit binaries"
                >
                  64-bit: {archSummary.a64}
                </button>
                <button
                  onClick={() => runScanWithArch("32-bit")}
                  className={`${chipBase} ${
                    archFilter === "32-bit" ? active : inactive
                  } bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-transparent`}
                  title="Show only 32-bit binaries"
                >
                  32-bit: {archSummary.a32}
                </button>
                <button
                  onClick={() => runScanWithArch("unknown")}
                  className={`${chipBase} ${
                    archFilter === "unknown" ? active : inactive
                  } bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-transparent`}
                  title="Show only unknown architecture binaries"
                >
                  unknown: {archSummary.unk}
                </button>
                <button
                  onClick={() => runScanWithArch("all")}
                  className={`${chipBase} ${
                    archFilter === "all" ? active : inactive
                  } bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border-transparent`}
                  title="Show all architectures"
                >
                  total: {archSummary.total}
                </button>
              </div>

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by path/file/arch…"
                className="px-2 py-1 border rounded-lg text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ minWidth: 220 }}
              />

              <button
                onClick={resetFilters}
                className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Clear search and restore default sort"
              >
                Reset filters
              </button>

              <button
                onClick={exportJSON}
                className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs hover:bg-slate-800"
              >
                Export JSON
              </button>
              <button
                onClick={exportCSV}
                className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs hover:bg-slate-800"
              >
                Export CSV
              </button>
            </div>
          </div>

          {filteredAndSorted.length === 0 ? (
            <div className="text-sm text-gray-500">
              {binaries.length === 0 ? (
                <>
                  No binaries yet. Choose a folder and click{" "}
                  <strong>Run Scan</strong> or <strong>Scan + Analysis</strong>.
                </>
              ) : (
                <>No results match your filter.</>
              )}
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
                    <th className="px-4 py-2 text-left font-medium">Verdict</th>
                    <th className="px-4 py-2 text-left font-medium">Recommended</th>
                    <th className="px-4 py-2 text-left font-medium">Execution Path</th>
                    <th className="px-4 py-2 text-left font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredCoreRows.map(({ binary: b, report }, i) => (
                    <tr
                      key={i}
                      className="hover:bg-gray-50/60 dark:hover:bg-gray-800/50 align-top"
                    >
                      <td className="px-4 py-3">
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
                        {report?.format && (
                          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            {report.format} · {report.arch || "unknown"}
                          </div>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs max-w-[360px] break-all"
                        title={b.path}
                      >
                        {b.path}
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs max-w-[220px] break-all"
                        title={b.file}
                      >
                        <div>{b.file || (b.path ? b.path.split("/").pop() : "")}</div>
                        {report?.script_interpreter && (
                          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            interp: {report.script_interpreter}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {report ? (
                          <div className="space-y-1">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${verdictBadgeClass(report.verdict)}`}>
                              {report.verdict}
                            </span>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              score: {scorePercent(report.compatibility_score)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {report?.recommended ? (
                          <div className="space-y-1">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${strategyBadgeClass(report.recommended.name)}`}>
                              {report.recommended.name}
                            </span>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 max-w-[240px]">
                              {report.recommended.rationale}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-mono break-all">{report?.execution_path || "—"}</div>
                        {report?.alternatives?.length > 0 && (
                          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            Alt: {report.alternatives.slice(0, 2).map((a) => a.name).join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[360px]">
                        {report ? (
                          <div className="space-y-2">
                            {report.blockers?.length > 0 && (
                              <div>
                                <div className="font-semibold text-red-600 dark:text-red-300 mb-1">Blockers</div>
                                <ul className="list-disc ml-4 space-y-1">
                                  {report.blockers.slice(0, 3).map((blk, idx) => (
                                    <li key={idx}>
                                      <span className="font-mono">{blk.code}</span>: {blk.message}
                                      {blk.remediation ? ` — ${blk.remediation}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {report.remediation_steps?.length > 0 && (
                              <div>
                                <div className="font-semibold text-amber-700 dark:text-amber-300 mb-1">Remediation</div>
                                <ul className="list-disc ml-4 space-y-1">
                                  {report.remediation_steps.slice(0, 3).map((step, idx) => (
                                    <li key={idx}>{step}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {report.risks?.length > 0 && (
                              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                Risk: {report.risks.slice(0, 2).join(" | ")}
                              </div>
                            )}
                            {(!report.blockers?.length && !report.remediation_steps?.length && !report.risks?.length) && (
                              <span className="text-gray-500">No additional details.</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">No core report.</span>
                        )}
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
          <h3 className="text-md font-semibold mb-2">Cache</h3>
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
