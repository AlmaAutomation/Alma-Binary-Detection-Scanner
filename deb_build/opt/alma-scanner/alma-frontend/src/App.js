// src/App.js
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AlmaScanDashboard from "./components/AlmaScanDashboard.jsx";

export default function App() {
  return (
    <Routes>
      {/* at /app -> go to /app/dashboard */}
      <Route path="/" element={<Navigate to="dashboard" replace />} />
      <Route path="/dashboard" element={<AlmaScanDashboard />} />
      {/* catch-all inside /app */}
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}
