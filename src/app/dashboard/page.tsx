"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface HistoryItem {
  id: string;
  url: string;
  title: string;
  date: string;
  total: number;
  success: number;
  failed: number;
  cost: number;
}

const MOCK_HISTORY: HistoryItem[] = [
  {
    id: "h7a3d2",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSfWvey6y1WNfpn-YxSpSiRblSedRQM-tr9Orr-51DaRwsRMAQ/viewform",
    title: "Questionnaire on Transportation Planning Strategies for Improved Urban Mobility in Kigali City",
    date: "Jul 10, 2026, 10:30 AM",
    total: 214,
    success: 214,
    failed: 0,
    cost: 12610
  },
  {
    id: "x9c8v4",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSfWvey6y1WNfpn-YxSpSiRblSedRQM-tr9Orr-51DaRwsRMAQ/viewform",
    title: "Questionnaire on Transportation Planning Strategies for Improved Urban Mobility in Kigali City",
    date: "Jul 9, 2026, 02:45 PM",
    total: 186,
    success: 183,
    failed: 3,
    cost: 10790
  },
  {
    id: "a1b2c3",
    url: "https://docs.google.com/forms/d/e/example-course-evaluation/viewform",
    title: "University of Rwanda - Course Evaluation & Student Feedback Survey (UR-CSE)",
    date: "Jul 5, 2026, 09:15 AM",
    total: 20,
    success: 20,
    failed: 0,
    cost: 0
  }
];

export default function DashboardPage() {
  const { user, loginWithGoogle } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pendingTxId, setPendingTxId] = useState<string | null>(null);

  useEffect(() => {
    const activePendingId = localStorage.getItem("mfasha_pending_tx_id");
    if (activePendingId) {
      setPendingTxId(activePendingId);
    }
  }, []);

  useEffect(() => {
    if (!pendingTxId) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status?id=${encodeURIComponent(pendingTxId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "approved") {
            clearInterval(intervalId);
            localStorage.removeItem("mfasha_pending_tx_id");
            setPendingTxId(null);
            window.location.reload();
          } else if (data.status === "rejected") {
            clearInterval(intervalId);
            localStorage.removeItem("mfasha_pending_tx_id");
            setPendingTxId(null);
          }
        }
      } catch (e) {
        console.error("Error checking pending payment on dashboard:", e);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [pendingTxId]);

  useEffect(() => {
    const savedHistory = localStorage.getItem("mfasha_history") || localStorage.getItem("formflo_history");
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (parsed && parsed.length > 0) {
          setHistory(parsed);
          return;
        }
      } catch (e) {
        console.error("Failed to parse history");
      }
    }
    // Fallback/Default mock history if empty
    setHistory(MOCK_HISTORY);
    localStorage.setItem("mfasha_history", JSON.stringify(MOCK_HISTORY));
  }, []);

  const handleClearHistory = () => {
    localStorage.removeItem("mfasha_history");
    localStorage.removeItem("formflo_history");
    setHistory([]);
  };

  // Calculations
  const totalSubmissions = history.reduce((sum, item) => sum + item.total, 0);
  const totalSuccess = history.reduce((sum, item) => sum + item.success, 0);
  const totalCost = history.reduce((sum, item) => sum + item.cost, 0);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 text-xl font-bold">
          🔒
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="text-sm text-zinc-400 max-w-sm mx-auto">
            Please log in with your Google account to view your submission history and dashboard metrics.
          </p>
        </div>
        <button
          onClick={loginWithGoogle}
          className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-zinc-900 text-sm font-semibold px-5 py-2.5 rounded-lg transition-all shadow-md active:scale-95 cursor-pointer"
        >
          Login with Google
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-6">
        <div className="flex items-center gap-4">
          <img
            src={user.image}
            alt={user.name}
            className="w-12 h-12 rounded-full border border-zinc-800 shadow-lg"
          />
          <div>
            <h2 className="text-xl font-bold text-white">Welcome back, {user.name}</h2>
            <p className="text-xs text-zinc-500">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-lg shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer"
          >
            + Create New Run
          </Link>
          <button
            onClick={handleClearHistory}
            className="bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-300 text-xs font-semibold px-4 py-2.5 rounded-lg border border-zinc-850 transition-all cursor-pointer"
          >
            Clear logs
          </button>
        </div>
      </div>

      {/* Pending Transaction Alert Banner */}
      {pendingTxId && (
        <div className="bg-amber-950/20 border border-amber-500/15 text-amber-200 p-4 rounded-2xl flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-lg animate-pulse">⏳</span>
            <div className="text-left">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Payment Verification Pending</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                We are waiting for your Mobile Money transaction (Ref: <strong className="font-mono text-amber-400">{pendingTxId}</strong>) to be approved.
                Once confirmed, your quota will be updated automatically.
              </p>
            </div>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/25 uppercase tracking-widest text-[9px] animate-pulse">
            Waiting Approval
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-zinc-950 border border-zinc-900/80 p-5 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-500 font-semibold block uppercase tracking-wider">Forms Processed</span>
            <span className="text-3xl font-extrabold text-white mt-2 block">{history.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-900/80 p-5 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-500 font-semibold block uppercase tracking-wider">Total Submissions</span>
            <span className="text-3xl font-extrabold text-emerald-400 mt-2 block">
              {totalSubmissions}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-900/80 p-5 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-500 font-semibold block uppercase tracking-wider">Premium Spendings</span>
            <span className="text-3xl font-extrabold text-emerald-400 mt-2 block">
              {totalCost.toLocaleString()} RWF
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
        </div>
      </div>

      {/* History Log Table */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-zinc-900">
          <h3 className="font-semibold text-white">Execution Logs</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Historical overview of form response submissions</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-900/20 text-zinc-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Google Form Title</th>
                <th className="px-6 py-3.5 text-center">Submissions</th>
                <th className="px-6 py-3.5 text-center">Accuracy</th>
                <th className="px-6 py-3.5 text-right">Cost</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    No run logs found. Create your first run from the homepage!
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-900/10 text-zinc-300 transition-colors">
                    <td className="px-6 py-4 font-medium whitespace-nowrap text-zinc-400">{item.date}</td>
                    <td className="px-6 py-4 max-w-[280px] truncate font-semibold text-white">
                      {item.title}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-zinc-100">{item.total}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 font-semibold">
                        {Math.round((item.success / item.total) * 100)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-400">
                      {item.cost === 0 ? "Free" : `${item.cost.toLocaleString()} RWF`}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-3">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          View Form ↗
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
