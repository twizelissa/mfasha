"use client";

import React, { useEffect, useRef } from "react";

interface ProgressTrackerProps {
  total: number;
  current: number;
  successCount: number;
  failureCount: number;
  logs: string[];
  isCompleted: boolean;
  onDone: () => void;
}

export default function ProgressTracker({
  total,
  current,
  successCount,
  failureCount,
  logs,
  isCompleted,
  onDone
}: ProgressTrackerProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const percent = Math.min(100, Math.round((current / total) * 100)) || 0;

  useEffect(() => {
    // Auto-scroll the terminal to the bottom as new logs arrive
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <div>
          <h3 className="font-semibold text-lg text-white">Submission Progress</h3>
          <p className="text-xs text-zinc-400">
            {isCompleted ? "All operations completed" : "Running automated submissions in real-time"}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          isCompleted 
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" 
            : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 animate-pulse"
        }`}>
          {isCompleted ? "Finished" : "Processing"}
        </span>
      </div>

      {/* Progress Bar & Percentage */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-zinc-300">Submitting responses...</span>
          <span className="text-indigo-400">{percent}% ({current}/{total})</span>
        </div>
        <div className="h-2.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-500 block">Success Responses</span>
            <span className="text-2xl font-bold text-emerald-400 mt-1 block">{successCount}</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            ✓
          </div>
        </div>
        
        <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-500 block">Failures / Errors</span>
            <span className="text-2xl font-bold text-rose-400 mt-1 block">{failureCount}</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold">
            ✗
          </div>
        </div>
      </div>

      {/* Terminal logs shell */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-zinc-400">Live Console Logs</span>
          <span className="text-[10px] text-zinc-500 font-mono">PAGER=cat</span>
        </div>
        
        <div className="h-60 bg-black border border-zinc-900 rounded-xl p-4 font-mono text-[11px] leading-relaxed overflow-y-auto space-y-1.5 scrollbar-thin">
          <div className="text-zinc-500">&gt; Initializing worker connection...</div>
          {logs.map((log, idx) => {
            const isSuccess = log.toLowerCase().includes("success");
            const isError = log.toLowerCase().includes("error") || log.toLowerCase().includes("warning");
            
            return (
              <div 
                key={idx} 
                className={`${
                  isSuccess 
                    ? "text-emerald-400" 
                    : isError 
                      ? "text-rose-400" 
                      : "text-zinc-300"
                }`}
              >
                <span className="text-zinc-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                {isSuccess ? "✓ " : isError ? "✗ " : ""}
                {log}
              </div>
            );
          })}
          {!isCompleted && (
            <div className="text-indigo-400 animate-pulse flex items-center gap-1.5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
              <span>Streaming payload submissions...</span>
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* Finish button */}
      {isCompleted && (
        <div className="pt-2">
          <button
            onClick={onDone}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-850 text-white font-semibold text-sm border border-zinc-800 rounded-xl transition-all shadow-lg active:scale-98"
          >
            Reset wizard
          </button>
        </div>
      )}

    </div>
  );
}
