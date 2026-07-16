"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FormQuestion, ParsedForm } from "@/utils/formParser";
import PaymentModal from "@/components/PaymentModal";
import ProgressTracker from "@/components/ProgressTracker";

export default function HomePage() {
  const { user, loginWithGoogle, incrementQuota } = useAuth();
  
  // Wizard steps: "input" | "preview" | "progress"
  const [step, setStep] = useState<"input" | "preview" | "progress">("input");
  
  // URL Input states
  const [formUrl, setFormUrl] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  
  // Parsed Form states
  const [parsedForm, setParsedForm] = useState<ParsedForm | null>(null);
  
  // Generation Options
  const [responseCount, setResponseCount] = useState(50);
  
  // Modal states
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  
  // Progress states
  const [currentProgress, setCurrentProgress] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [isSubmittingCompleted, setIsSubmittingCompleted] = useState(false);

  // Quota & pricing calculations
  const remainingFree = Math.max(0, 20 - (user?.quotaUsed || 0));
  const premiumCount = Math.max(0, responseCount - remainingFree);
  const totalCost = premiumCount * 65;

  const handleFetchForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUrl) return;
    
    setIsFetching(true);
    setFetchError("");
    
    try {
      const res = await fetch("/api/parse-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: formUrl })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse Google Form.");
      }
      
      setParsedForm(data);
      setStep("preview");
    } catch (err: any) {
      setFetchError(err.message || "An unexpected error occurred.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleStartGeneration = () => {
    // If not logged in, prompt Google Login
    if (!user) {
      loginWithGoogle();
      return;
    }
    
    // Check if payment is required
    if (premiumCount > 0) {
      setIsPaymentOpen(true);
    } else {
      executeSubmission();
    }
  };

  const handlePaymentSuccess = (txId?: string) => {
    setIsPaymentOpen(false);
    executeSubmission(txId);
  };

  const executeSubmission = async (txId?: string) => {
    if (!parsedForm) return;
    
    setStep("progress");
    setCurrentProgress(0);
    setSuccessCount(0);
    setFailureCount(0);
    setLogs([]);
    setIsSubmittingCompleted(false);
    
    try {
      const res = await fetch("/api/submit-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: formUrl,
          questions: parsedForm.questions,
          count: responseCount,
          fbzx: parsedForm.fbzx,
          formTitle: parsedForm.title,
          pageHistory: parsedForm.pageHistory,
          email: user?.email || "anonymous@ur.ac.rw",
          transactionId: txId
        })
      });
      
      if (!res.body) {
        throw new Error("Response body is not readable");
      }
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let localSuccess = 0;
      let localFailure = 0;
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        
        for (const part of parts) {
          if (part.startsWith("data: ")) {
            const jsonStr = part.substring(6);
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === "progress") {
                setCurrentProgress(event.index);
                if (event.success) {
                  localSuccess++;
                  setSuccessCount(localSuccess);
                } else {
                  localFailure++;
                  setFailureCount(localFailure);
                }
                setLogs(prev => [...prev, event.message]);
              } else if (event.type === "done") {
                setIsSubmittingCompleted(true);
                // Deduct used free quota
                const freeUsed = Math.min(responseCount, remainingFree);
                incrementQuota(freeUsed);
                
                // Add to submission history
                saveRunToHistory({
                  url: formUrl,
                  title: parsedForm.title,
                  total: responseCount,
                  success: event.successCount !== undefined ? event.successCount : localSuccess,
                  failed: event.failureCount !== undefined ? event.failureCount : localFailure,
                  cost: totalCost
                });
              } else if (event.type === "error") {
                setLogs(prev => [...prev, `Critical Error: ${event.error}`]);
                setIsSubmittingCompleted(true);
              }
            } catch (e) {
              console.error("Error parsing stream chunk", e);
            }
          }
        }
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `Fatal Error: ${err.message}`]);
      setIsSubmittingCompleted(true);
    }
  };

  const saveRunToHistory = (run: {
    url: string;
    title: string;
    total: number;
    success: number;
    failed: number;
    cost: number;
  }) => {
    const history = localStorage.getItem("formflo_history");
    const items = history ? JSON.parse(history) : [];
    
    const newItem = {
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      ...run
    };
    
    localStorage.setItem("formflo_history", JSON.stringify([newItem, ...items]));
  };

  const resetWizard = () => {
    setStep("input");
    setFormUrl("");
    setParsedForm(null);
    setResponseCount(50);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-12 relative">
      
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none -z-10 animate-pulse-slow" />

      {step === "input" && (
        <div className="w-full max-w-2xl text-center space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/15">
              <span>🚀 FormFlo v1.0 Live</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              Generate High-Fidelity <br />
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                Google Form Responses
              </span>
            </h1>
            <p className="text-zinc-400 text-sm md:text-base max-w-lg mx-auto">
              Extract fields and submit randomized, realistic survey answers instantly. Perfect for system testing, stress testing, and academic mock datasets.
            </p>
          </div>

          {/* Form Parser Input */}
          <form onSubmit={handleFetchForm} className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800/80 shadow-xl space-y-4">
            <div className="flex flex-col text-left space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Google Form URL</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="url"
                  required
                  placeholder="https://docs.google.com/forms/d/e/.../viewform"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-medium transition-all"
                />
                <button
                  type="submit"
                  disabled={isFetching}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-indigo-500/10 transition-all flex items-center justify-center gap-2"
                >
                  {isFetching ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-t-white border-indigo-400 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    "Fetch Form Fields"
                  )}
                </button>
              </div>
            </div>
            {fetchError && (
              <p className="text-rose-400 text-xs font-medium text-left mt-2 flex items-center gap-1.5">
                <span>⚠</span> {fetchError}
              </p>
            )}
          </form>

          {/* Guidelines / Features Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-left">
            <div className="bg-zinc-950/40 p-5 rounded-xl border border-zinc-900 space-y-2">
              <div className="text-indigo-400 text-lg font-bold">01</div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Dynamic Fields</h3>
              <p className="text-xs text-zinc-500">Automatically parses checkboxes, radios, linear scales, dropdowns, and text fields.</p>
            </div>
            <div className="bg-zinc-950/40 p-5 rounded-xl border border-zinc-900 space-y-2">
              <div className="text-indigo-400 text-lg font-bold">02</div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Smart Generation</h3>
              <p className="text-xs text-zinc-500">Injects realistic, weighted options and synthesizes context-aware academic recommendations.</p>
            </div>
            <div className="bg-zinc-950/40 p-5 rounded-xl border border-zinc-900 space-y-2">
              <div className="text-indigo-400 text-lg font-bold">03</div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Quota & Payments</h3>
              <p className="text-xs text-zinc-500">Enjoy 20 free submissions per user, and purchase additional ones via secure card or MoMo simulation.</p>
            </div>
          </div>
        </div>
      )}

      {step === "preview" && parsedForm && (
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Question Preview Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div>
                <button
                  onClick={resetWizard}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mb-3"
                >
                  ← Change URL
                </button>
                <h2 className="text-xl font-bold text-white leading-snug">{parsedForm.title}</h2>
                {parsedForm.description && (
                  <p className="text-xs text-zinc-400 mt-2 line-clamp-3 leading-relaxed">
                    {String(parsedForm.description).replace(/<[^>]*>/g, "")}
                  </p>
                )}
              </div>

              {/* Questions preview container */}
              <div className="border-t border-zinc-900 pt-4 space-y-4">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Extracted Survey Questions ({parsedForm.questions.length})</span>
                <div className="max-h-[350px] overflow-y-auto pr-1 space-y-3 scrollbar-thin">
                  {parsedForm.questions.map((q, idx) => (
                    <div key={idx} className="bg-zinc-900/30 border border-zinc-900 p-3.5 rounded-xl flex flex-col space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs font-semibold text-zinc-200">{String(q.title).replace(/<[^>]*>/g, "")}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-850 text-zinc-500 border border-zinc-800">
                          {q.type}
                        </span>
                      </div>
                      {q.choices.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {q.choices.map((choice, cIdx) => (
                            <span key={cIdx} className="text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded-md">
                              {choice}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Generation Setup Card */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="font-semibold text-white">Generation Settings</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Specify response configurations</p>
            </div>

            {/* Slider */}
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-400">Response Quantity</span>
                <span className="text-indigo-400">{responseCount} records</span>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                step={5}
                value={responseCount}
                onChange={(e) => setResponseCount(Number(e.target.value))}
                className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-medium">
                <span>10</span>
                <span>100</span>
                <span>250</span>
                <span>500</span>
              </div>
            </div>

            {/* Pricing Breakdowns */}
            <div className="border-t border-zinc-900 pt-4 space-y-3 text-xs font-medium">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Cost breakdown</span>
              <div className="flex justify-between text-zinc-400">
                <span>Total Quantity</span>
                <span className="text-zinc-200">{responseCount}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Remaining Free Quota</span>
                <span className="text-zinc-200">{remainingFree}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Premium Responses</span>
                <span className="text-zinc-200">{premiumCount}</span>
              </div>
              <div className="flex justify-between text-zinc-400 border-t border-zinc-900 pt-3 text-sm">
                <span className="font-semibold text-white">Final Price</span>
                <span className="font-bold text-indigo-400">{totalCost.toLocaleString()} RWF</span>
              </div>
            </div>

            {/* Trigger Button */}
            <div className="pt-2">
              {user ? (
                <button
                  onClick={handleStartGeneration}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/10 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>⚡</span>
                  {premiumCount > 0 ? `Pay & Generate` : "Generate Free Responses"}
                </button>
              ) : (
                <button
                  onClick={loginWithGoogle}
                  className="w-full py-3 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white font-semibold text-sm border border-zinc-800 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" width="24" height="24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Login to Continue
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {step === "progress" && (
        <div className="w-full max-w-2xl">
          <ProgressTracker
            total={responseCount}
            current={currentProgress}
            successCount={successCount}
            failureCount={failureCount}
            logs={logs}
            isCompleted={isSubmittingCompleted}
            onDone={resetWizard}
          />
        </div>
      )}

      {/* Modals */}
      {isPaymentOpen && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          onSuccess={handlePaymentSuccess}
          amount={totalCost}
          responseCount={responseCount}
          formUrl={formUrl}
        />
      )}
    </div>
  );
}
