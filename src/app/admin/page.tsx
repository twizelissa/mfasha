"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface Payment {
  id: string;
  payerName: string;
  amount: number;
  responseCount: number;
  formUrl: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      const res = await fetch("/api/payments/list");
      if (!res.ok) throw new Error("Failed to load transactions.");
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    // Poll every 5 seconds so the admin sees updates in real-time
    const intervalId = setInterval(fetchPayments, 5000);
    return () => clearInterval(intervalId);
  }, []);

  const handleUpdateStatus = async (id: string, status: "approved" | "rejected") => {
    setActioningId(id);
    try {
      const res = await fetch("/api/payments/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });

      if (!res.ok) throw new Error("Failed to update status.");
      
      // Update local state immediately
      setPayments(prev => 
        prev.map(p => p.id === id ? { ...p, status } : p)
      );
    } catch (err: any) {
      alert(err.message || "Error updating transaction.");
    } finally {
      setActioningId(null);
    }
  };

  const filteredPayments = payments.filter(p => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  const pendingCount = payments.filter(p => p.status === "pending").length;
  const approvedTotal = payments
    .filter(p => p.status === "approved")
    .reduce((sum, p) => sum + p.amount, 0);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-500 flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-t-white border-zinc-800 rounded-full animate-spin" />
        Checking credentials...
      </div>
    );
  }

  if (!user || user.email !== "twizelissa@gmail.com") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-850 p-8 rounded-2xl text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center text-3xl mx-auto border border-rose-500/10">
            🔒
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Access Denied</h1>
            <p className="text-sm text-zinc-400">
              Only authorized administrator accounts can access this verification console.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Mfasha Admin</h1>
            <p className="text-xs text-zinc-500 mt-1">Review, approve, and reject manual Mobile Money payments</p>
          </div>
          <Link
            href="/"
            className="self-start sm:self-auto bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-semibold px-4 py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer"
          >
            ← Back to App
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-zinc-900/40 border border-zinc-850 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500 font-semibold block uppercase tracking-wider">Pending Action</span>
              <span className="text-3xl font-extrabold text-amber-500 mt-2 block">{pendingCount}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-lg">
              ⏳
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-850 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500 font-semibold block uppercase tracking-wider">Approved Revenue</span>
              <span className="text-3xl font-extrabold text-emerald-400 mt-2 block">
                {approvedTotal.toLocaleString()} RWF
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-lg">
              💰
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-850 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500 font-semibold block uppercase tracking-wider">Total Orders</span>
              <span className="text-3xl font-extrabold text-emerald-400 mt-2 block">{payments.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-lg">
              📦
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 items-center justify-between pt-2">
          <div className="flex gap-2">
            {(["all", "pending", "approved", "rejected"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all cursor-pointer ${
                  filter === t
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={fetchPayments}
            className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            🔄 Refresh List
          </button>
        </div>

        {/* Payments Table */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="py-20 text-center text-sm text-zinc-500 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-t-white border-zinc-800 rounded-full animate-spin" />
              Loading payments list...
            </div>
          ) : error ? (
            <div className="py-20 text-center text-rose-400 text-sm">
              ⚠ Error loading database: {error}
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="py-20 text-center text-zinc-500 text-sm">
              No transactions matching the filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-900/20 text-zinc-400 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Submitted At</th>
                    <th className="px-6 py-4">Payer / MoMo Name</th>
                    <th className="px-6 py-4">Transaction Reference ID</th>
                    <th className="px-6 py-4">Form Details</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {filteredPayments.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-900/10 text-zinc-300 transition-colors">
                      <td className="px-6 py-4 font-medium whitespace-nowrap text-zinc-500">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-bold text-white whitespace-nowrap">
                        {item.payerName}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {item.id}
                      </td>
                      <td className="px-6 py-4 max-w-[200px] truncate">
                        <span className="font-semibold text-zinc-200 block truncate">
                          {item.responseCount} responses
                        </span>
                        <a
                          href={item.formUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-zinc-500 hover:text-zinc-400 block truncate"
                        >
                          {item.formUrl}
                        </a>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-white whitespace-nowrap">
                        {item.amount.toLocaleString()} RWF
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          item.status === "pending"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/15"
                            : item.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/15"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {item.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleUpdateStatus(item.id, "approved")}
                              disabled={actioningId !== null}
                              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-md transition-all active:scale-95 cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(item.id, "rejected")}
                              disabled={actioningId !== null}
                              className="bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/15 text-rose-400 font-bold px-3 py-1.5 rounded-md transition-all active:scale-95 cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-600">No actions</span>
                        )}
                      </td>
                    </tr>

                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
