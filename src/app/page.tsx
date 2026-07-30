"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { FormQuestion, ParsedForm } from "@/utils/formParser";
import PaymentModal from "@/components/PaymentModal";
import ProgressTracker from "@/components/ProgressTracker";
import { generateQuestionResponse } from "@/utils/responseGenerator";

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
  const [injectionMode, setInjectionMode] = useState<"cloud" | "browser">("browser");
  const [showBypassPrompt, setShowBypassPrompt] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Progress states
  const [currentProgress, setCurrentProgress] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [isSubmittingCompleted, setIsSubmittingCompleted] = useState(false);

  // Isometric SVG active layer
  const [selectedLayer, setSelectedLayer] = useState<"sense" | "analyze" | "act">("sense");

  // Rotating words for subtitle
  const rotatorWords = ["course surveys.", "feedback forms.", "market research.", "academic studies."];
  const [wordIdx, setWordIdx] = useState(0);
  const [animClass, setAnimClass] = useState("rotator-word-in");

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setAnimClass("rotator-word-out");
      setTimeout(() => {
        setWordIdx((prev) => (prev + 1) % rotatorWords.length);
        setAnimClass("rotator-word-in");
      }, 480);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Quota & pricing calculations
  const isAdmin = user?.email?.toLowerCase() === "twizelissa@gmail.com";
  const remainingFree = isAdmin ? 999999999 : Math.max(0, 20 - (user?.quotaUsed || 0));
  const premiumCount = isAdmin ? 0 : Math.max(0, responseCount - remainingFree);
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
    if (!user) {
      loginWithGoogle();
      return;
    }
    
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

  const executeSubmission = async (txId?: string, modeOverride?: "cloud" | "browser") => {
    if (!parsedForm) return;
    
    setStep("progress");
    setCurrentProgress(0);
    setSuccessCount(0);
    setFailureCount(0);
    setLogs([]);
    setIsSubmittingCompleted(false);
    setShowBypassPrompt(false);
    
    let localSuccess = 0;
    let localFailure = 0;

    const activeMode = modeOverride || injectionMode;

    if (activeMode === "browser") {
      setLogs([]);
      
      const formResponseUrl = formUrl.replace("/viewform", "/formResponse").replace("/formResponse", "/formResponse");

      // Open a single popup window to act as the top-level navigation container.
      // This bypasses the SameSite=Lax cookie restrictions that block hidden subframes/iframes from sending session cookies.
      let popup: Window | null = null;
      try {
        popup = window.open("about:blank", "mfasha-popup", "width=500,height=400,scrollbars=yes,resizable=yes");
      } catch (err) {
        console.error("Popup window block error", err);
      }

      if (!popup) {
        setLogs((prev) => [
          ...prev,
          "❌ Popup window blocked. Please click the allow popup button in your browser address bar to proceed."
        ]);
        setIsSubmittingCompleted(true);
        return;
      }

      for (let i = 0; i < responseCount; i++) {
        try {
          const payloadData: { name: string; value: string }[] = [];
          for (const q of parsedForm.questions) {
            const answer = generateQuestionResponse(q, parsedForm.title);
            if (Array.isArray(answer)) {
              for (const val of answer) {
                payloadData.push({ name: q.entry, value: val });
              }
            } else {
              payloadData.push({ name: q.entry, value: answer });
            }
          }

          payloadData.push({ name: "pageHistory", value: parsedForm.pageHistory || "0" });
          payloadData.push({ name: "fvv", value: "1" });
          if (parsedForm.fbzx) {
            payloadData.push({ name: "fbzx", value: parsedForm.fbzx });
          }

          const formEl = document.createElement("form");
          formEl.method = "POST";
          formEl.action = formResponseUrl;
          formEl.target = "mfasha-popup";
          formEl.style.display = "none";

          for (const field of payloadData) {
            const inputEl = document.createElement("input");
            inputEl.type = "hidden";
            inputEl.name = field.name;
            inputEl.value = field.value;
            formEl.appendChild(inputEl);
          }

          document.body.appendChild(formEl);
          formEl.submit();
          
          // Delay form element removal to allow the browser to initiate the network POST request.
          setTimeout(() => {
            if (formEl.parentNode) {
              formEl.parentNode.removeChild(formEl);
            }
          }, 2000);

          localSuccess++;
          setSuccessCount(localSuccess);
          setCurrentProgress(i + 1);
          setLogs((prev) => [...prev, `[Browser] Response ${i + 1} injected successfully`]);

        } catch (e: any) {
          localFailure++;
          setFailureCount(localFailure);
          setLogs((prev) => [...prev, `✗ [Browser Error] Response ${i + 1} injection failed: ${e.message}`]);
        }

        // Delay between submissions to allow the page inside the popup to process and record the response.
        await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 400));
      }

      // Close the popup window after completion
      try {
        popup.close();
      } catch (err) {
        console.error("Error closing popup", err);
      }

      setIsSubmittingCompleted(true);
      const freeUsed = Math.min(responseCount, remainingFree);
      incrementQuota(freeUsed);

      saveRunToHistory({
        url: formUrl,
        title: parsedForm.title,
        total: responseCount,
        success: localSuccess,
        failed: localFailure,
        cost: totalCost
      });

      return;
    }
    
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
                  if (event.message.includes("status 401") || event.message.includes("Unauthorized")) {
                    setShowBypassPrompt(true);
                  }
                }
                setLogs(prev => [...prev, event.message]);
              } else if (event.type === "done") {
                setIsSubmittingCompleted(true);
                const freeUsed = Math.min(responseCount, remainingFree);
                incrementQuota(freeUsed);
                
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
                saveRunToHistory({
                  url: formUrl,
                  title: parsedForm.title,
                  total: responseCount,
                  success: localSuccess,
                  failed: responseCount - localSuccess,
                  cost: totalCost
                });
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
      saveRunToHistory({
        url: formUrl,
        title: parsedForm.title,
        total: responseCount,
        success: localSuccess,
        failed: responseCount - localSuccess,
        cost: totalCost
      });
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

  useEffect(() => {
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
    <div className="w-full relative font-sans">
      
      {/* Background radial glows & grids */}
      <div className="absolute inset-0 tech-grid opacity-60 pointer-events-none -z-10" />

      {step === "input" && (
        <div className="space-y-24">
          
          {/* Split Hero Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center pt-8 md:pt-16">
            
            {/* Left Hero Content & Action Panel */}
            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-6">
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black font-tight tracking-tight text-[#F5F1EA] leading-[1.05] text-left uppercase">
                  High-Fidelity <br />
                  Datasets.
                </h1>
                
                <p className="text-[#a39c8e] text-lg leading-relaxed max-w-xl text-left font-sans font-light">
                  Mfasha is the automation layer for the systems that test your{" "}
                  <span className={`font-bold text-[#F54343] transition-all duration-300 ${animClass}`}>
                    {rotatorWords[wordIdx]}
                  </span>
                </p>
              </div>

              {/* Pill-shaped buttons just like sandtech.com hero */}
              <div className="flex flex-wrap items-center gap-4 text-left">
                {!mounted || !user ? (
                  <button
                    onClick={loginWithGoogle}
                    className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold px-6 py-3 rounded-full transition-all duration-300 shadow-md cursor-pointer"
                  >
                    Get Started <span className="font-light">→</span>
                  </button>
                ) : (
                  <a
                    href="#parse-box"
                    className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold px-6 py-3 rounded-full transition-all duration-300 shadow-md cursor-pointer"
                  >
                    Start Parsing <span className="font-light">→</span>
                  </a>
                )}
                
                <a
                  href="#pipeline"
                  className="flex items-center gap-2 bg-transparent text-white border border-zinc-800 hover:border-white text-xs font-semibold px-6 py-3 rounded-full transition-all duration-300 cursor-pointer"
                >
                  Learn more
                </a>
              </div>

              {/* Form Parser Input Box for Authenticated Users (Anchored) */}
              {mounted && user && (
                <div id="parse-box" className="w-full max-w-lg pt-4 scroll-mt-24">
                  <form onSubmit={handleFetchForm} className="bg-card/30 p-6 rounded border border-border shadow-2xl space-y-4 text-left">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono text-[#10b981] uppercase tracking-widest block">AUTHENTICATED AS {user?.name?.toUpperCase()}</span>
                      <h3 className="text-xs font-mono font-bold text-[#F5F1EA] uppercase">Paste Google Form Link</h3>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="url"
                        required
                        placeholder="https://docs.google.com/forms/d/e/.../viewform"
                        value={formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                        className="flex-1 bg-[#121212] border border-border rounded px-4 py-3 text-xs text-[#F5F1EA] placeholder-[#a39c8e]/50 focus:outline-none focus:border-primary font-mono transition-all"
                      />
                      <button
                        type="submit"
                        disabled={isFetching}
                        className="bg-primary hover:bg-transparent text-background hover:text-primary font-mono text-xs font-bold px-6 py-3 border border-primary transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap uppercase tracking-wider"
                      >
                        {isFetching ? (
                          <>
                            <div className="w-3.5 h-3.5 rounded-full border border-t-background border-primary animate-spin" />
                            PARSING
                          </>
                        ) : (
                          "FETCH FIELDS"
                        )}
                      </button>
                    </div>
                    {fetchError && (
                      <p className="text-[#F54343] font-mono text-[11px] flex items-center gap-1.5">
                        <span>⚠</span> {fetchError.toUpperCase()}
                      </p>
                    )}
                  </form>
                </div>
              )}
            </div>

            {/* Right Product Showcase Mockup */}
            <div className="lg:col-span-5 w-full">
              <div className="relative group mx-auto max-w-[420px]">
                
                {/* Behind-card glows */}
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent-coral rounded opacity-15 group-hover:opacity-20 transition duration-1000 blur-md" />
                
                {/* Main Mock Container */}
                <div className="relative bg-[#0A0A0A] border border-border rounded overflow-hidden shadow-2xl flex flex-col">
                  
                  {/* Mock Window Header */}
                  <div className="bg-[#111111] border-b border-border px-4 py-3.5 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#F54343]/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#F1AE0A]/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#80A2B4]/60" />
                    </div>
                    <span className="text-[9px] text-[#a39c8e] font-mono select-none tracking-widest">MFASHA.TECH // WORKER_NODE_04</span>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 font-mono font-bold tracking-wide uppercase">ACTIVE</span>
                  </div>

                  {/* Mock Card Body */}
                  <div className="p-5 space-y-4 text-left">
                    
                    {/* Simulated Job Name */}
                    <div className="space-y-1 border-b border-border pb-3">
                      <span className="text-[9px] text-[#a39c8e] uppercase tracking-widest font-mono">NODE TARGET SPEC</span>
                      <p className="text-xs font-bold text-[#F5F1EA] truncate uppercase tracking-wide">Student Survey & Feedback Questionnaire</p>
                    </div>

                    {/* Progress details */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-muted-foreground uppercase">Payload Injections</span>
                        <span className="text-primary font-bold">{Math.round((simCount / 200) * 100)}%</span>
                      </div>
                      
                      {/* Animated Progress Bar */}
                      <div className="h-1.5 w-full bg-[#111111] rounded-sm overflow-hidden border border-border/50">
                        <div 
                          className="h-full bg-[#F1AE0A] rounded-sm transition-all duration-700 ease-out"
                          style={{ width: `${(simCount / 200) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Numerical indicators */}
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="bg-[#111111] border border-border/80 p-3 rounded-sm flex items-center justify-between">
                        <div>
                          <span className="text-[9px] text-[#a39c8e] font-mono uppercase tracking-widest block">SUBMISSIONS</span>
                          <span className="text-sm font-bold font-mono text-[#F5F1EA] mt-0.5 block">{simCount} / 200</span>
                        </div>
                      </div>
                      <div className="bg-[#111111] border border-border/80 p-3 rounded-sm flex items-center justify-between">
                        <div>
                          <span className="text-[9px] text-[#a39c8e] font-mono uppercase tracking-widest block">HTTP CODE</span>
                          <span className="text-xs font-bold text-[#10b981] mt-0.5 inline-flex items-center gap-1 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
                            200_OK
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Simulated Live Logs Shell */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[9px] text-[#a39c8e] font-mono uppercase tracking-widest">OUTPUT STREAM BUFFER</span>
                      <div className="bg-[#050505] border border-border p-3.5 rounded-sm font-mono text-[9px] text-muted-foreground space-y-1 h-[110px] overflow-hidden leading-relaxed">
                        {simLogs.map((log, i) => (
                          <div key={i} className="truncate">
                            <span className="text-[#F1AE0A] mr-1.5">&gt;</span>
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

          {/* Trusted Logo Bar (Sandtech inspired) */}
          <div className="pt-8 border-t border-[#222222] text-center space-y-4">
            <span className="font-mono text-[9px] text-[#a39c8e]/60 uppercase tracking-widest block">
              TRUSTED ACROSS ACADEMIA, RESEARCH INSTITUTES, AND SURVEY SYSTEMS
            </span>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-45 grayscale hover:grayscale-0 transition-all duration-300">
              <span className="text-sm font-black font-tight tracking-wider text-[#F5F1EA]">Google Forms</span>
              <span className="text-sm font-black font-tight tracking-wider text-[#F5F1EA]">Airtable</span>
              <span className="text-sm font-black font-tight tracking-wider text-[#F5F1EA]">Microsoft Excel</span>
              <span className="text-sm font-black font-tight tracking-wider text-[#F5F1EA]">Qualtrics</span>
              <span className="text-sm font-black font-tight tracking-wider text-[#F5F1EA]">SurveyMonkey</span>
            </div>
          </div>

          {/* Why use Mfasha Section */}
          <div id="features" className="pt-16 border-t border-[#222222] text-left space-y-8 scroll-mt-24">
            <div className="space-y-2">
              <span className="font-mono text-[10px] text-[#80A2B4] uppercase tracking-widest block">02 / BENEFITS</span>
              <h2 className="text-3xl font-black font-tight tracking-tight text-[#F5F1EA] uppercase">Why Use Mfasha?</h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl font-sans">
                Fast, secure, and reliable bulk automation built for academic research data collection.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="bg-[#111111] p-6 rounded-sm border border-border space-y-4 hover:border-primary/60 transition-all duration-300">
                <span className="font-mono text-[11px] text-[#80A2B4] tracking-wider block">01 // PARSER</span>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Automated Form Parsing</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Simply paste the form URL. We scan and organize choice options, checkbox grids, and text prompts instantly, saving hours of manual field mapping.
                </p>
              </div>

              <div className="bg-[#111111] p-6 rounded-sm border border-border space-y-4 hover:border-[#F1AE0A]/60 transition-all duration-300">
                <span className="font-mono text-[11px] text-[#F1AE0A] tracking-wider block">02 // SYNTHESIS</span>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Balanced Academic Datasets</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Generates logical, randomized data payloads matching your study parameters. Avoid static, repeating responses and get balanced data for statistical testing.
                </p>
              </div>

              <div className="bg-[#111111] p-6 rounded-sm border border-border space-y-4 hover:border-[#F54343]/60 transition-all duration-300">
                <span className="font-mono text-[11px] text-[#F54343] tracking-wider block">03 // VELOCITY</span>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Simulated Data Collection</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Simulate and collect high-volume response sets for research testing with easy quota top-ups via Mobile Money (MTN MoMo, Airtel Money).
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Axonometric SVG Stack (How It Works) */}
          <div id="pipeline" className="pt-16 border-t border-[#222222] text-left space-y-12 scroll-mt-24">
            <div className="space-y-3">
              <span className="font-mono text-[10px] text-[#F54343] uppercase tracking-widest block">03 / PIPELINE</span>
              <h2 className="text-3xl font-black font-tight tracking-tight text-[#F5F1EA] uppercase">How Mfasha Works</h2>
              <p className="text-[#a39c8e] text-sm leading-relaxed max-w-2xl font-sans">
                Explore the automated steps Mfasha takes from parsing fields to streaming response injections.
              </p>
            </div>

            {/* Interactive Section Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Left Side: Interactive SVG Stack */}
              <div className="lg:col-span-7 flex justify-center py-4 bg-[#111111]/30 border border-border/60 rounded">
                <svg viewBox="0 0 800 600" className="w-full max-w-[500px] h-auto overflow-visible select-none">
                  {/* Vertical dotted connector line */}
                  <path d="M400,170 L400,450" stroke="rgba(245, 241, 234, 0.12)" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                  
                  {/* Streaming glowing particle path */}
                  <path d="M400,170 L400,450" stroke="#F1AE0A" strokeWidth="2" className="particle" fill="none" />
                  
                  {/* Layer 03 / ACT (Bottom Plate) */}
                  <g 
                    onClick={() => setSelectedLayer("act")}
                    style={{
                      transform: selectedLayer === "act" ? "translateY(-12px)" : "translateY(0px)",
                      cursor: "pointer",
                      transition: "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)"
                    }}
                  >
                    {/* Bottom Side thickness */}
                    <polygon points="150,450 400,540 400,548 150,458" fill="#141412" stroke="none" />
                    <polygon points="400,540 650,450 650,458 400,548" fill="#1A1A17" stroke="none" />
                    {/* Top surface */}
                    <polygon 
                      points="400,360 650,450 400,540 150,450" 
                      fill={selectedLayer === "act" ? "#241F14" : "#1A1A19"} 
                      stroke={selectedLayer === "act" ? "#F1AE0A" : "rgba(245, 241, 234, 0.15)"} 
                      strokeWidth={selectedLayer === "act" ? 1.5 : 1}
                      className="plane-surface"
                    />
                    {/* Graphical components inside ACT layer */}
                    <path d="M320,440 L320,475 M320,475 L316,468 M320,475 L324,468" stroke="#F54343" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M400,460 L400,495 M400,495 L396,488 M400,495 L404,488" stroke="#F54343" strokeWidth="2" strokeLinecap="round" />
                    <path d="M480,440 L480,475 M480,475 L476,468 M480,475 L484,468" stroke="#F54343" strokeWidth="1.5" strokeLinecap="round" />
                    {/* Layer text label */}
                    <text x="180" y="505" fontFamily="var(--font-mono)" fontSize="9" fill={selectedLayer === "act" ? "#F5F1EA" : "#a39c8e"} letterSpacing="0.1em" opacity="0.8">03 // ACT (PAYLOAD_INJECTOR)</text>
                  </g>

                  {/* Layer 02 / ANALYZE (Middle Plate) */}
                  <g 
                    onClick={() => setSelectedLayer("analyze")}
                    style={{
                      transform: selectedLayer === "analyze" ? "translateY(-12px)" : "translateY(0px)",
                      cursor: "pointer",
                      transition: "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)"
                    }}
                  >
                    {/* Bottom Side thickness */}
                    <polygon points="150,310 400,400 400,408 150,318" fill="#141412" stroke="none" />
                    <polygon points="400,400 650,310 650,318 400,408" fill="#1A1A17" stroke="none" />
                    {/* Top surface */}
                    <polygon 
                      points="400,220 650,310 400,400 150,310" 
                      fill={selectedLayer === "analyze" ? "#241F14" : "#1A1A19"} 
                      stroke={selectedLayer === "analyze" ? "#F1AE0A" : "rgba(245, 241, 234, 0.15)"} 
                      strokeWidth={selectedLayer === "analyze" ? 1.5 : 1}
                      className="plane-surface"
                    />
                    {/* Connected graph nodes inside ANALYZE */}
                    <line x1="400" y1="310" x2="320" y2="280" stroke={selectedLayer === "analyze" ? "#F1AE0A" : "#80A2B4"} strokeWidth="1" strokeOpacity="0.7" />
                    <line x1="400" y1="310" x2="480" y2="280" stroke={selectedLayer === "analyze" ? "#F1AE0A" : "#80A2B4"} strokeWidth="1" strokeOpacity="0.7" />
                    <line x1="320" y1="280" x2="400" y2="250" stroke={selectedLayer === "analyze" ? "#F1AE0A" : "#80A2B4"} strokeWidth="1" strokeOpacity="0.7" />
                    <line x1="480" y1="280" x2="400" y2="250" stroke={selectedLayer === "analyze" ? "#F1AE0A" : "#80A2B4"} strokeWidth="1" strokeOpacity="0.7" />
                    <circle cx="400" cy="310" r="3.5" fill="#F1AE0A" />
                    <circle cx="320" cy="280" r="3.5" fill="#F54343" />
                    <circle cx="480" cy="280" r="3.5" fill="#80A2B4" />
                    <circle cx="400" cy="250" r="3.5" fill="#10b981" />
                    {/* Layer text label */}
                    <text x="180" y="365" fontFamily="var(--font-mono)" fontSize="9" fill={selectedLayer === "analyze" ? "#F5F1EA" : "#a39c8e"} letterSpacing="0.1em" opacity="0.8">02 // ANALYZE (RESPONSE_BUILDER)</text>
                  </g>

                  {/* Layer 01 / SENSE (Top Plate) */}
                  <g 
                    onClick={() => setSelectedLayer("sense")}
                    style={{
                      transform: selectedLayer === "sense" ? "translateY(-12px)" : "translateY(0px)",
                      cursor: "pointer",
                      transition: "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)"
                    }}
                  >
                    {/* Bottom Side thickness */}
                    <polygon points="150,170 400,260 400,268 150,178" fill="#141412" stroke="none" />
                    <polygon points="400,260 650,170 650,178 400,268" fill="#1A1A17" stroke="none" />
                    {/* Top surface */}
                    <polygon 
                      points="400,80 650,170 400,260 150,170" 
                      fill={selectedLayer === "sense" ? "#241F14" : "#1A1A19"} 
                      stroke={selectedLayer === "sense" ? "#F1AE0A" : "rgba(245, 241, 234, 0.15)"} 
                      strokeWidth={selectedLayer === "sense" ? 1.5 : 1}
                      className="plane-surface"
                    />
                    {/* Radar graphic on top plate */}
                    <ellipse cx="400" cy="170" rx="55" ry="25" fill="none" stroke="#80A2B4" strokeWidth="1" strokeDasharray="3 3" />
                    <ellipse cx="400" cy="170" rx="25" ry="12.5" fill="none" stroke="#80A2B4" strokeWidth="1" />
                    <circle cx="400" cy="170" r="2.5" fill="#80A2B4" />
                    {/* Scanning radar indicator */}
                    <line x1="400" y1="170" x2="445" y2="155" stroke="#F1AE0A" strokeWidth="1.2" strokeLinecap="round" />
                    {/* Layer text label */}
                    <text x="180" y="225" fontFamily="var(--font-mono)" fontSize="9" fill={selectedLayer === "sense" ? "#F5F1EA" : "#a39c8e"} letterSpacing="0.1em" opacity="0.8">01 // SENSE (FORM_PARSER)</text>
                  </g>
                </svg>
              </div>

              {/* Right Side: Informational Tab details */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Selector Buttons */}
                <div className="flex gap-2 border-b border-border pb-3">
                  <button 
                    onClick={() => setSelectedLayer("sense")}
                    className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border rounded-sm transition-all cursor-pointer ${selectedLayer === "sense" ? "bg-primary text-background border-primary font-bold" : "bg-transparent text-muted-foreground border-border hover:text-foreground"}`}
                  >
                    01 / SENSE
                  </button>
                  <button 
                    onClick={() => setSelectedLayer("analyze")}
                    className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border rounded-sm transition-all cursor-pointer ${selectedLayer === "analyze" ? "bg-primary text-background border-primary font-bold" : "bg-transparent text-muted-foreground border-border hover:text-foreground"}`}
                  >
                    02 / ANALYZE
                  </button>
                  <button 
                    onClick={() => setSelectedLayer("act")}
                    className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border rounded-sm transition-all cursor-pointer ${selectedLayer === "act" ? "bg-primary text-background border-primary font-bold" : "bg-transparent text-muted-foreground border-border hover:text-foreground"}`}
                  >
                    03 / ACT
                  </button>
                </div>

                {/* Tab content panels */}
                {selectedLayer === "sense" && (
                  <div className="space-y-4 animate-fade">
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] text-[#80A2B4] uppercase tracking-wider block">STAGE / SCAN_FIELD</span>
                      <h4 className="text-lg font-bold text-[#F5F1EA] uppercase">Automated Form Parser</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                      Supply the target Google Form link. The parser engine automatically scrapes the DOM to capture form structures: question titles, multiple-choice options, checkboxes, nested grid structures, and crucial tracker codes like `fbzx` parameters and page histories.
                    </p>
                    <div className="bg-[#111111] p-4 border border-border/60 rounded-sm font-mono text-[10px] text-[#a39c8e] space-y-1">
                      <div className="text-[#10b981]">● SCAN STATUS: READY</div>
                      <div>● TARGET CONSTRAINTS: PUBLIC GOOGLE FORMS</div>
                      <div>● FIELD PARSING: STABLE</div>
                    </div>
                  </div>
                )}

                {selectedLayer === "analyze" && (
                  <div className="space-y-4 animate-fade">
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] text-[#F1AE0A] uppercase tracking-wider block">STAGE / DATA_BUILDER</span>
                      <h4 className="text-lg font-bold text-[#F5F1EA] uppercase">Weighted Random Response Builder</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                      Instead of repetitive static data, Mfasha builds balanced datasets. It calculates statistical weights and distributions, generating randomized payloads that behave like organic survey participants to satisfy test models and filter rules.
                    </p>
                    <div className="bg-[#111111] p-4 border border-border/60 rounded-sm font-mono text-[10px] text-[#a39c8e] space-y-1">
                      <div className="text-[#F1AE0A]">● LOGIC: BALANCED DISTRIBUTIONS</div>
                      <div>● COMPLEX GRID TYPES: SUPPORTED</div>
                      <div>● RANDOMIZATION SEEDS: ACTIVE</div>
                    </div>
                  </div>
                )}

                {selectedLayer === "act" && (
                  <div className="space-y-4 animate-fade">
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] text-[#F54343] uppercase tracking-wider block">STAGE / PAYLOAD_INJECTOR</span>
                      <h4 className="text-lg font-bold text-[#F5F1EA] uppercase">Distributed Injections Engine</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                      Streams injection payloads directly to Google Form endpoints. Mfasha maps submission paths and establishes connection profiles, firing simulated entries at speed with real-time log streaming output.
                    </p>
                    <div className="bg-[#111111] p-4 border border-border/60 rounded-sm font-mono text-[10px] text-[#a39c8e] space-y-1">
                      <div className="text-[#F54343]">● CONNECTION PROTOCOL: HTTP/2 POST</div>
                      <div>● INJECTION GATEWAY: ESTABLISHED</div>
                      <div>● LATENCY PROFILE: ~150MS PER PAYLOAD</div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Specifications Table Section - CREAM BACKGROUND BANNER (Matches sandtech screenshot middle section) */}
          <div id="specs" className="w-screen relative left-[50%] right-[50%] -mx-[50vw] bg-[#F5F1EA] py-16 scroll-mt-24 text-zinc-950">
            <div className="max-w-7xl mx-auto px-6 space-y-8 text-left">
              <div className="space-y-2">
                <span className="font-mono text-[10px] text-[#F54343] uppercase tracking-widest block font-bold">04 / DIAGNOSTICS</span>
                <h2 className="text-3xl font-black font-tight tracking-tight text-zinc-950 uppercase">Engine Specifications</h2>
              </div>
              
              <div className="overflow-x-auto w-full border border-zinc-300 rounded-sm bg-[#FBF9F5]">
                <table className="w-full border-collapse font-sans text-sm">
                  <thead>
                    <tr className="bg-[#E8E2D6] border-b border-zinc-300 text-left">
                      <th className="font-mono text-[10px] font-bold text-zinc-600 uppercase tracking-widest p-4">Component</th>
                      <th className="font-mono text-[10px] font-bold text-zinc-600 uppercase tracking-widest p-4">Methodology</th>
                      <th className="font-mono text-[10px] font-bold text-zinc-600 uppercase tracking-widest p-4">Autonomy</th>
                      <th className="font-mono text-[10px] font-bold text-zinc-600 uppercase tracking-widest p-4">Latency</th>
                      <th className="font-mono text-[10px] font-bold text-zinc-600 uppercase tracking-widest p-4">Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-zinc-200">
                      <td className="p-4 font-mono text-[11px] font-bold text-zinc-900">01 / SENSE</td>
                      <td className="p-4 text-zinc-700">DOM Schema Scraping</td>
                      <td className="p-4">
                        <span className="badge-outline text-[#10b981] border-[#10b981] px-2 py-0.5 rounded text-[9px] font-mono font-bold">AUTO</span>
                      </td>
                      <td className="p-4 font-mono text-zinc-700">&lt; 1.2s</td>
                      <td className="p-4 text-zinc-600 font-light">Public Google Forms (No corporate SSO auth)</td>
                    </tr>
                    <tr className="border-b border-zinc-200">
                      <td className="p-4 font-mono text-[11px] font-bold text-zinc-900">02 / ANALYZE</td>
                      <td className="p-4 text-zinc-700">Weighted statistical randomization</td>
                      <td className="p-4">
                        <span className="badge-outline text-[#F1AE0A] border-[#F1AE0A] px-2 py-0.5 rounded text-[9px] font-mono font-bold">LOOP</span>
                      </td>
                      <td className="p-4 font-mono text-zinc-700">&lt; 0.1s</td>
                      <td className="p-4 text-zinc-600 font-light">Checkboxes, radio lists, matrix scales, text fields</td>
                    </tr>
                    <tr className="border-b border-zinc-200">
                      <td className="p-4 font-mono text-[11px] font-bold text-zinc-900">03 / ACT</td>
                      <td className="p-4 text-zinc-700">Distributed asynchronous HTTP injections</td>
                      <td className="p-4">
                        <span className="badge-outline text-[#80A2B4] border-[#80A2B4] px-2 py-0.5 rounded text-[9px] font-mono font-bold">SUP</span>
                      </td>
                      <td className="p-4 font-mono text-zinc-700">~150ms/req</td>
                      <td className="p-4 text-zinc-600 font-light">Real-time streaming log terminal output</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Full Footer Section (Redesigned matching sandtech screenshot footer) */}
          <div className="w-screen relative left-[50%] right-[50%] -mx-[50vw] bg-[#050505] pt-20 pb-8 text-[#a39c8e] border-t border-[#222222]">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-12 text-left">
              
              {/* Left Column: Logo & Newsletter */}
              <div className="md:col-span-4 space-y-6">
                <span className="font-tight font-black text-2xl tracking-widest text-[#F5F1EA] flex items-center gap-1">
                  MF<span className="text-primary font-light">▲</span>SHA
                </span>
                <p className="text-xs text-[#a39c8e]/80 leading-relaxed font-sans max-w-sm">
                  High-fidelity mock survey responses, automated parameters scraping, and statistical balanced injections. Built for academic research.
                </p>
                
                {/* Social icons */}
                <div className="flex gap-3">
                  <a href="#" className="w-8 h-8 rounded-full border border-[#222222] flex items-center justify-center text-[#F5F1EA] hover:border-white transition-all text-xs font-mono">X</a>
                  <a href="#" className="w-8 h-8 rounded-full border border-[#222222] flex items-center justify-center text-[#F5F1EA] hover:border-white transition-all text-xs font-mono">IN</a>
                  <a href="#" className="w-8 h-8 rounded-full border border-[#222222] flex items-center justify-center text-[#F5F1EA] hover:border-white transition-all text-xs font-mono">YT</a>
                </div>

                {/* Newsletter sign up form */}
                <div className="space-y-2 pt-2">
                  <span className="font-mono text-[9px] text-[#F5F1EA]/80 uppercase tracking-widest block font-bold">Subscribe To Newsletter*</span>
                  <div className="flex items-center justify-between border-b border-[#222222] pb-1 max-w-[280px]">
                    <input 
                      type="email" 
                      placeholder="ENTER EMAIL ADDRESS" 
                      className="bg-transparent text-xs text-[#F5F1EA] placeholder-[#a39c8e]/40 focus:outline-none w-full"
                    />
                    <button className="text-xs text-[#F5F1EA] hover:text-[#F1AE0A] transition-all font-mono pl-2 cursor-pointer">→</button>
                  </div>
                </div>
              </div>

              {/* Right Columns */}
              <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
                <div className="space-y-4">
                  <span className="font-mono text-[10px] text-[#F5F1EA] uppercase tracking-widest font-bold block">PLATFORM</span>
                  <ul className="space-y-2 text-xs font-light text-[#a39c8e]/80">
                    <li><a href="#pipeline" className="hover:text-white transition-colors">Symmetri Engine</a></li>
                    <li><a href="#specs" className="hover:text-white transition-colors">Autonomy Levels</a></li>
                    <li><a href="#specs" className="hover:text-white transition-colors">Specifications</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Partner Ecosystem</a></li>
                  </ul>
                </div>
                
                <div className="space-y-4">
                  <span className="font-mono text-[10px] text-[#F5F1EA] uppercase tracking-widest font-bold block">FEATURES</span>
                  <ul className="space-y-2 text-xs font-light text-[#a39c8e]/80">
                    <li><a href="#features" className="hover:text-white transition-colors">Form Parser</a></li>
                    <li><a href="#features" className="hover:text-white transition-colors">Randomizer</a></li>
                    <li><a href="#features" className="hover:text-white transition-colors">Bulk Injection</a></li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <span className="font-mono text-[10px] text-[#F5F1EA] uppercase tracking-widest font-bold block">COMPANY</span>
                  <ul className="space-y-2 text-xs font-light text-[#a39c8e]/80">
                    <li><a href="#" className="hover:text-white transition-colors">Team</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Insights</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <span className="font-mono text-[10px] text-[#F5F1EA] uppercase tracking-widest font-bold block">GET IN TOUCH</span>
                  <ul className="space-y-2 text-xs font-light text-[#a39c8e]/80">
                    <li><a href="#" className="hover:text-white transition-colors">Request Demo</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Become a Partner</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Contact Support</a></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Bottom Row Locations & copyright */}
            <div className="max-w-7xl mx-auto px-6 pt-16 mt-8 border-t border-[#151515] flex flex-col sm:flex-row items-center justify-between text-[10px] text-[#a39c8e]/60 font-mono tracking-widest gap-4 text-center sm:text-left">
              <div className="flex flex-wrap justify-center gap-4">
                <span>● KIGALI</span>
                <span>● SAN FRANCISCO</span>
                <span>● LONDON</span>
                <span>● CAPE TOWN</span>
              </div>
              <div className="flex flex-wrap justify-center gap-6">
                <span>© {new Date().getFullYear()} MFASHA. ALL RIGHTS RESERVED</span>
                <a href="#" className="hover:text-white">LEGAL DISCLAIMERS</a>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Step === "preview" */}
      {step === "preview" && parsedForm && (
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left mt-4 pb-12">
          
          {/* Main Question Preview Panel */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-[#111111] border border-border p-6 rounded-sm space-y-4 shadow-xl">
              <div>
                <button
                  onClick={resetWizard}
                  className="text-[10px] font-mono font-bold text-primary hover:text-primary/80 flex items-center gap-1 mb-3 cursor-pointer uppercase tracking-wider"
                >
                  ← BACK_TO_SCAN
                </button>
                <span className="font-mono text-[9px] text-[#80A2B4] uppercase tracking-widest block mb-1">TARGET_DISCOVERED</span>
                <h2 className="text-xl font-bold font-tight text-[#F5F1EA] leading-snug uppercase">{parsedForm.title}</h2>
                {parsedForm.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed font-sans">
                    {String(parsedForm.description).replace(/<[^>]*>/g, "")}
                  </p>
                )}
              </div>

              {/* Questions preview container */}
              <div className="border-t border-border/60 pt-4 space-y-4">
                <span className="text-[10px] font-mono font-bold text-[#a39c8e] uppercase tracking-widest">Extracted Survey Fields ({parsedForm.questions.length})</span>
                <div className="max-h-[380px] overflow-y-auto pr-2 space-y-3 scrollbar-thin">
                  {parsedForm.questions.map((q, idx) => (
                    <div key={idx} className="bg-[#0A0A0A] border border-border/80 p-4 rounded-sm flex flex-col space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs font-semibold text-[#F5F1EA]">{String(q.title).replace(/<[^>]*>/g, "")}</span>
                        <span className="badge-outline text-[9px] text-[#a39c8e] border-border bg-[#111111]">
                          {q.type.toUpperCase()}
                        </span>
                      </div>
                      {q.choices.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {q.choices.map((choice, cIdx) => (
                            <span key={cIdx} className="text-[9px] font-mono bg-[#111111] text-[#a39c8e] border border-border px-2 py-0.5 rounded-sm">
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
          <div className="lg:col-span-4 bg-[#111111] border border-border p-6 rounded-sm shadow-xl space-y-6">
            <div className="space-y-1">
              <span className="font-mono text-[9px] text-primary uppercase tracking-widest block">STEP 02 / CONFIG</span>
              <h3 className="font-bold text-[#F5F1EA] uppercase">Injection Specs</h3>
              <p className="text-[10px] text-[#a39c8e]">Configure payload counts</p>
            </div>

            {/* Slider & Manual Input */}
            <div className="space-y-4 text-left">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#a39c8e]">INJECTIONS</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={responseCount}
                    onChange={(e) => {
                      const val = Math.max(10, Math.min(500, Number(e.target.value)));
                      setResponseCount(val);
                    }}
                    className="w-16 bg-[#0A0A0A] border border-border rounded px-2 py-1 text-xs text-white text-center font-bold font-mono focus:outline-none focus:border-primary"
                  />
                  <span className="text-primary font-bold">sets</span>
                </div>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                step={5}
                value={responseCount}
                onChange={(e) => setResponseCount(Number(e.target.value))}
                className="w-full h-1 bg-[#0A0A0A] rounded appearance-none cursor-pointer accent-primary border border-border"
              />
              <div className="flex justify-between text-[9px] text-[#a39c8e] font-mono">
                <span>10</span>
                <span>100</span>
                <span>250</span>
                <span>500</span>
              </div>
            </div>

            <p className="text-[9px] text-[#a39c8e]/80 leading-relaxed font-sans pt-3 border-t border-border/40">
              🌐 Browser session injections. Automatically uses your active browser Google login cookies to bypass login screens and SSO blocks.
            </p>

            {/* Pricing Breakdowns */}
            <div className="border-t border-border pt-4 space-y-3 text-xs font-mono text-left">
              <span className="text-[9px] font-bold text-[#a39c8e] uppercase tracking-widest block mb-2">Cost breakdown</span>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Quantity</span>
                <span className="text-foreground">{responseCount}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Remaining Free Quota</span>
                <span className="text-foreground">{isAdmin ? "Unlimited" : remainingFree}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Premium Responses</span>
                <span className="text-foreground">{premiumCount}</span>
              </div>
              <div className="flex justify-between text-muted-foreground border-t border-border pt-3 text-sm">
                <span className="font-semibold text-[#F5F1EA] uppercase">Final Price</span>
                <span className="font-bold text-primary">{totalCost.toLocaleString()} RWF</span>
              </div>
            </div>

            {/* Trigger Button */}
            <div className="pt-2">
              {mounted && user ? (
                <button
                  onClick={handleStartGeneration}
                  className="w-full py-3 bg-primary hover:bg-transparent text-background hover:text-primary font-mono text-xs font-bold border border-primary transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  {premiumCount > 0 ? `Pay & Generate` : isAdmin ? "Generate Responses" : "Generate Free Responses"}
                </button>
              ) : (
                <button
                  onClick={loginWithGoogle}
                  className="w-full py-3 bg-[#0A0A0A] hover:bg-[#151515] text-[#a39c8e] hover:text-white font-mono text-[10px] border border-border transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" width="24" height="24">
                    <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.535 0-6.403-2.885-6.403-6.4s2.868-6.4 6.403-6.4c1.582 0 3.03.58 4.153 1.538l3.078-3.078C19.123 2.215 15.86 1 12.24 1 6.033 1 12.24 6.033 1 12.24s5.033 11.24 11.24 11.24c6.207 0 11.24-5.033 11.24-11.24 0-.756-.073-1.503-.2-2.24H12.24z" />
                  </svg>
                  Login to Continue
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {step === "progress" && (
        <div className="w-full max-w-2xl mx-auto space-y-6 mt-4 pb-12">
          <div className="bg-[#111111] border border-border p-6 rounded-sm shadow-xl">
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
