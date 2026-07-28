import React from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";

import AlmaScanDashboard from "./components/AlmaScanDashboard";
import AIB_AlmaScanDashboard from "./components/AIB_AlmaScanDashboard";
import CompatibilityExplorerPanel from "./components/CompatibilityExplorerPanel";
import CompatibilityCatalogPanel from "./components/CompatibilityCatalogPanel";

export default function App() {
  const navigate = useNavigate();

  return (
    <>
      <header className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="text-sm font-semibold">Alma Scanner</div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <nav className="flex gap-3 text-sm">
            <Link to="/dashboard" className="text-indigo-600 dark:text-indigo-300 hover:underline">
              Scanner (Only)
            </Link>
            <Link to="/ews-analysis" className="text-emerald-600 dark:text-emerald-300 hover:underline">
              EWS + Analysis
            </Link>
            <Link to="/explorer" className="text-teal-600 dark:text-teal-300 hover:underline">
              Explorer
            </Link>
            <Link to="/catalog" className="text-teal-600 dark:text-teal-300 hover:underline">
              Catalog
            </Link>
          </nav>
          <button
            onClick={() => navigate("/ews-analysis")}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800"
          >
            Run Live Demo
          </button>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<AlmaScanDashboard />} />
          <Route path="/ews-analysis" element={<AIB_AlmaScanDashboard />} />
          <Route path="/explorer" element={<CompatibilityExplorerPanel />} />
          <Route path="/catalog" element={<CompatibilityCatalogPanel />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </>
  );
}
