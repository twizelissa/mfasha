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
    const history = localStorage.getItem("mfasha_history") || localStorage.getItem("formflo_history");
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
    
    localStorage.setItem("mfasha_history", JSON.stringify([newItem, ...items]));
  };

  // Simulated preview state for the home page mockup
  const [simCount, setSimCount] = useState(142);
  const [simLogs, setSimLogs] = useState<string[]>([
    "✓ Initializing worker connection on mfasha.tech...",
    "✓ Extracted 6 input fields successfully",
    "✓ Target: Course Evaluation & Feedback Form",
    "✓ Response #140 submitted successfully",
    "✓ Response #141 submitted successfully",
  ]);

  React.useEffect(() => {
    if (step !== "input") return;
    const interval = setInterval(() => {
      setSimCount((prev) => {
        const next = prev >= 200 ? 130 : prev + 1;
        setSimLogs((prevLogs) => {
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const newLogs = [...prevLogs, `[${time}] ✓ Response #${next} submitted successfully`].slice(-5);
          return newLogs;
        });
        return next;
      });
    }, 2800);
    return () => clearInterval(interval);
  }, [step]);

  const resetWizard = () => {
    setStep("input");
    setFormUrl("");
    setParsedForm(null);
    setResponseCount(50);
  };

  return (
    <div className="w-full relative py-8 md:py-16">
      
      {/* Background radial glows & grids */}
      <div className="absolute inset-0 tech-grid opacity-70 pointer-events-none -z-10" />
      <div className="absolute top-12 left-1/3 w-[600px] h-[600px] rounded-full bg-emerald-950/20 blur-[120px] pointer-events-none -z-10 animate-pulse-slow" />
      <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] rounded-full bg-teal-950/25 blur-[100px] pointer-events-none -z-10" />

      {step === "input" && (
        <div className="space-y-16">
          
          {/* Split Hero Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Hero Content & Action Panel */}
            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1] text-left">
                  Collect Responses for <br />
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                    Any Google Form Survey
                  </span> <br />
                  in 1-Click
                </h1>
                <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-xl text-left">
                  Easily generate high-fidelity, balanced mock response datasets to test methodologies, validate statistical models, or complete your university research projects. Supports any public survey or questionnaire.
                </p>
              </div>

              {/* Authentication / URL Action Container */}
              <div className="w-full max-w-lg">
                {!user ? (
                  /* Google Sign In Call to Action */
                  <div className="bg-zinc-950/90 border border-zinc-900 p-6 sm:p-8 rounded-2xl shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-50" />
                    <div className="relative space-y-5">
                      <div className="space-y-1 text-left">
                        <h3 className="text-base font-bold text-white">Get Google Form Responses</h3>
                        <p className="text-xs text-zinc-400 leading-normal">
                          Sign in with Google to parse your questionnaire. Get 20 free responses immediately to test your survey setup.
                        </p>
                      </div>
                      
                      <button
                        onClick={loginWithGoogle}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-950 text-sm font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all active:scale-98 cursor-pointer"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" width="24" height="24">
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
                        <span>Sign in with Google</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Form Parser Input Box for Authenticated Users */
                  <form onSubmit={handleFetchForm} className="bg-zinc-950/90 p-6 rounded-2xl border border-zinc-900 shadow-2xl space-y-4 text-left">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">Logged in as {user.name}</span>
                      <h3 className="text-sm font-bold text-white">Paste Google Form Link</h3>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="url"
                        required
                        placeholder="https://docs.google.com/forms/d/e/.../viewform"
                        value={formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-semibold transition-all"
                      />
                      <button
                        type="submit"
                        disabled={isFetching}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-semibold text-xs px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                      >
                        {isFetching ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-t-white border-emerald-400 animate-spin" />
                            Parsing...
                          </>
                        ) : (
                          "Fetch Fields"
                        )}
                      </button>
                    </div>
                    {fetchError && (
                      <p className="text-rose-400 text-xs font-semibold flex items-center gap-1.5">
                        <span>⚠</span> {fetchError}
                      </p>
                    )}
                  </form>
                )}
              </div>
            </div>

            {/* Right Product Showcase Mockup (Animated CSS) */}
            <div className="lg:col-span-5 w-full">
              <div className="relative group mx-auto max-w-[420px]">
                
                {/* Behind-card glows */}
                <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-lg opacity-25 group-hover:opacity-35 transition duration-1000" />
                
                {/* Main Mock Container */}
                <div className="relative bg-black border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                  
                  {/* Mock Window Header */}
                  <div className="bg-zinc-950 border-b border-zinc-900/80 px-4 py-3.5 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono select-none">mfasha.tech/worker</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 font-semibold">Running</span>
                  </div>

                  {/* Mock Card Body */}
                  <div className="p-5 space-y-4 text-left">
                    
                    {/* Simulated Job Name */}
                    <div className="space-y-1 border-b border-zinc-900 pb-3">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Job target</span>
                      <p className="text-xs font-bold text-white truncate">Student Survey & Feedback Questionnaire</p>
                    </div>

                    {/* Progress details */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-400 font-semibold">Uploading payloads</span>
                        <span className="text-emerald-400 font-bold font-mono">{Math.round((simCount / 200) * 100)}%</span>
                      </div>
                      
                      {/* Animated Progress Bar */}
                      <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-850">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${(simCount / 200) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Numerical indicators */}
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-zinc-500 block">Submissions</span>
                          <span className="text-base font-extrabold text-white mt-0.5 block">{simCount} / 200</span>
                        </div>
                      </div>
                      <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-zinc-500 block">Status Code</span>
                          <span className="text-xs font-bold text-emerald-400 mt-0.5 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            200 OK
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Simulated Live Logs Shell */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] text-zinc-500 font-mono">Live output buffer</span>
                      <div className="bg-black border border-zinc-900 p-3.5 rounded-xl font-mono text-[9px] text-zinc-400 space-y-1 h-[110px] overflow-hidden leading-relaxed">
                        {simLogs.map((log, i) => (
                          <div key={i} className="truncate">
                            <span className="text-zinc-600 mr-1.5">&gt;</span>
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Core Benefits Section */}
          <div className="space-y-6 pt-8 border-t border-zinc-900/60">
            <div className="text-left space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Why use Mfasha?</h2>
              <p className="text-xs sm:text-sm text-zinc-500">Fast, secure, and reliable bulk automation built for academic research data collection.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="bg-zinc-950/80 p-6 rounded-2xl border border-zinc-900 space-y-3 shadow-lg">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-white">Automated Form Parsing</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Simply paste the form URL. We automatically scan and organize choices, checkboxes, and grids instantly, saving hours of manual data setup.
                </p>
              </div>

              <div className="bg-zinc-950/80 p-6 rounded-2xl border border-zinc-900 space-y-3 shadow-lg">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 3 21 3 21 8" />
                    <line x1="4" y1="20" x2="21" y2="3" />
                    <polyline points="21 16 21 21 16 21" />
                    <line x1="15" y1="15" x2="21" y2="21" />
                    <line x1="4" y1="4" x2="9" y2="9" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-white">Balanced Academic Datasets</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Generates logical, randomized data payloads matching your study parameters. Avoid static, repeating responses and get balanced data for statistical testing.
                </p>
              </div>

              <div className="bg-zinc-950/80 p-6 rounded-2xl border border-zinc-900 space-y-3 shadow-lg">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-white">Simulated Data Collection</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Simulate and collect high-volume response sets for research testing with easy quota top-ups via Mobile Money (MTN MoMo, Airtel Money).
                </p>
              </div>
            </div>
          </div>

          {/* Simple Step-by-Step Guide */}
          <div className="space-y-6 pt-8 border-t border-zinc-900/60 text-left">
            <h2 className="text-xl sm:text-2xl font-bold text-white">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex gap-4">
                <span className="text-2xl font-black text-emerald-400/20 font-mono select-none">01</span>
                <div>
                  <h4 className="text-sm font-bold text-white">Paste URL</h4>
                  <p className="text-xs text-zinc-500 mt-1 leading-normal">Enter the edit/view link of any public Google Form to scan its questions.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="text-2xl font-black text-emerald-400/20 font-mono select-none">02</span>
                <div>
                  <h4 className="text-sm font-bold text-white">Sign In & Choose Quota</h4>
                  <p className="text-xs text-zinc-500 mt-1 leading-normal">Authenticate using Google and pick the number of submissions (20 free, up to 500 premium).</p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="text-2xl font-black text-emerald-400/20 font-mono select-none">03</span>
                <div>
                  <h4 className="text-sm font-bold text-white">Run Submissions</h4>
                  <p className="text-xs text-zinc-500 mt-1 leading-normal">Watch our live streaming progress log submit realistic data sets directly to Google Form servers.</p>
                </div>
              </div>
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
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mb-3 cursor-pointer"
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
            <div className="space-y-3 text-left">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-400">Response Quantity</span>
                <span className="text-emerald-400 font-bold">{responseCount} records</span>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                step={5}
                value={responseCount}
                onChange={(e) => setResponseCount(Number(e.target.value))}
                className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-medium">
                <span>10</span>
                <span>100</span>
                <span>250</span>
                <span>500</span>
              </div>
            </div>

            {/* Pricing Breakdowns */}
            <div className="border-t border-zinc-900 pt-4 space-y-3 text-xs font-medium text-left">
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
                <span className="font-bold text-emerald-400">{totalCost.toLocaleString()} RWF</span>
              </div>
            </div>

            {/* Trigger Button */}
            <div className="pt-2">
              {user ? (
                <button
                  onClick={handleStartGeneration}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/10 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {premiumCount > 0 ? `Pay & Generate` : "Generate Free Responses"}
                </button>
              ) : (
                <button
                  onClick={loginWithGoogle}
                  className="w-full py-3 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white font-semibold text-sm border border-zinc-800 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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
