"use client";

import React, { useState, useEffect } from "react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (txId?: string) => void;
  amount: number;
  responseCount: number;
  formUrl: string;
}

export default function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  amount,
  responseCount,
  formUrl
}: PaymentModalProps) {
  const [activeTab, setActiveTab] = useState<"card" | "momo">("momo");
  const [isProcessing, setIsProcessing] = useState(false);
  const [momoProvider, setMomoProvider] = useState<"mtn" | "airtel">("mtn");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [momoName, setMomoName] = useState("");
  const [momoError, setMomoError] = useState("");
  const [momoStep, setMomoStep] = useState<"input" | "waiting" | "success">("input");
  const [hasPaypack, setHasPaypack] = useState(false);
  const [momoSubTab, setMomoSubTab] = useState<"prompt" | "manual">("prompt");
  
  // Card states
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");

  useEffect(() => {
    const checkPaypackConfig = async () => {
      try {
        const res = await fetch("/api/payments/config");
        if (res.ok) {
          const data = await res.json();
          setHasPaypack(data.hasPaypack);
          if (data.hasPaypack) {
            setMomoSubTab("prompt");
          } else {
            setMomoSubTab("manual");
          }
        }
      } catch (err) {
        console.error("Failed to check Paypack config:", err);
      }
    };
    checkPaypackConfig();
  }, []);

  useEffect(() => {
    if (momoStep !== "waiting" || !transactionId) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status?id=${encodeURIComponent(transactionId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "approved") {
            clearInterval(intervalId);
            setIsProcessing(false);
            setMomoStep("success");
            
            // Show success for 1.5 seconds, then complete
            await new Promise((resolve) => setTimeout(resolve, 1500));
            onSuccess(transactionId);
          } else if (data.status === "rejected") {
            clearInterval(intervalId);
            setIsProcessing(false);
            setMomoStep("input");
            setMomoError(
              momoSubTab === "prompt"
                ? "Transaction was failed or cancelled. Please try again."
                : "Transaction was rejected by administrator. Please verify reference details."
            );
          }
        }
      } catch (err) {
        console.error("Failed to check payment status:", err);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [momoStep, transactionId, onSuccess, momoSubTab]);

  if (!isOpen) return null;

  const handleMomoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setMomoError("");

    try {
      if (momoSubTab === "prompt") {
        const cleanPhone = phoneNumber.replace(/\s+/g, "");
        if (!/^07[2389][0-9]{7}$/.test(cleanPhone)) {
          throw new Error("Please enter a valid Rwandan phone number (e.g. 078xxxxxxx)");
        }

        const res = await fetch("/api/payments/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: cleanPhone,
            amount,
            responseCount,
            formUrl
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to initiate mobile money prompt.");
        }

        setTransactionId(data.transactionId);
        setMomoStep("waiting");
      } else {
        if (!transactionId || !momoName) {
          throw new Error("Please enter both transaction ID and payer name.");
        }

        const res = await fetch("/api/payments/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId,
            payerName: momoName,
            amount,
            responseCount,
            formUrl
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to register transaction with server.");
        }

        setMomoStep("waiting");
      }
    } catch (err: any) {
      setIsProcessing(false);
      setMomoError(err.message || "Failed to process payment request.");
    }
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNumber.length < 16 || !cardExpiry || cardCvv.length < 3 || !cardName) return;

    setIsProcessing(true);
    // Simulate payment gateway authorization delay
    await new Promise((resolve) => setTimeout(resolve, 2500));
    setIsProcessing(false);
    onSuccess("CARD_MOCK_" + Math.random().toString(36).substring(2, 9).toUpperCase());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-500/5">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-900 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg text-white">Complete Payment</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Pay for {responseCount} responses ({responseCount - 20} premium)
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-zinc-400 block font-medium">Total Price</span>
            <span className="font-bold text-lg text-emerald-400">{amount.toLocaleString()} RWF</span>
          </div>
        </div>
 
        {/* Tabs */}
        {momoStep === "input" && (
          <div className="flex border-b border-zinc-900">
            <button
              onClick={() => setActiveTab("momo")}
              className={`flex-1 py-3.5 text-center text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "momo"
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                  : "border-transparent text-zinc-400 hover:text-zinc-300"
              }`}
            >
              Mobile Money (MoMo)
            </button>
            <button
              onClick={() => setActiveTab("card")}
              className={`flex-1 py-3.5 text-center text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "card"
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                  : "border-transparent text-zinc-400 hover:text-zinc-300"
              }`}
            >
              Credit Card
            </button>
          </div>
        )}
 
        {/* Content */}
        <div className="p-6">
          {activeTab === "momo" ? (
            /* MoMo Flow */
            momoStep === "input" ? (
              <form onSubmit={handleMomoSubmit} className="space-y-4">
                {/* Providers */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMomoProvider("mtn")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                      momoProvider === "mtn"
                        ? "border-yellow-500 bg-yellow-500/5 text-yellow-500"
                        : "border-zinc-850 hover:border-zinc-700 text-zinc-400"
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider">MTN MoMo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMomoProvider("airtel")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                      momoProvider === "airtel"
                        ? "border-red-500 bg-red-500/5 text-red-500"
                        : "border-zinc-850 hover:border-zinc-700 text-zinc-400"
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider">Airtel Money</span>
                  </button>
                </div>
 
                {/* Sub tabs: Instant Prompt vs Manual Fallback */}
                {hasPaypack && (
                  <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setMomoSubTab("prompt");
                        setMomoError("");
                      }}
                      className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        momoSubTab === "prompt"
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Instant Prompt
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMomoSubTab("manual");
                        setMomoError("");
                      }}
                      className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        momoSubTab === "manual"
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      📝 Manual Fallback
                    </button>
                  </div>
                )}
 
                {momoSubTab === "prompt" ? (
                  /* Instant Prompt Fields */
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Mobile Money Phone Number</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 0788123456"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition-all font-semibold"
                    />
                    <p className="text-[10px] text-zinc-500">
                      Enter your MTN MoMo or Airtel Money number. You will receive a secure prompt on your device to authorize the payment.
                    </p>
                  </div>
                ) : (
                  /* Manual Fallback Fields */
                  <>
                    {/* Instructions */}
                    <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-400 font-semibold uppercase tracking-wider">Manual Payment Code</span>
                        <span className={`font-bold px-2 py-0.5 rounded border ${
                          momoProvider === "mtn"
                            ? "bg-yellow-500/10 border-yellow-500/10 text-yellow-500"
                            : "bg-red-500/10 border-red-500/10 text-red-500"
                        }`}>
                          {momoProvider === "mtn" ? "MTN MoMo" : "Airtel Money"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-black border border-zinc-850 px-4 py-3 rounded-lg font-mono text-sm text-emerald-400 font-bold tracking-wider">
                        <span>*182*8*1*566832#</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText("*182*8*1*566832#")}
                          className="text-[10px] bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white px-2 py-1 rounded border border-zinc-800 transition-all active:scale-95 cursor-pointer"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="text-[10px] text-zinc-500 leading-normal space-y-1">
                        <p>1. Dial the USSD code above on your mobile phone.</p>
                        <p>2. Enter payment amount: <strong className="text-zinc-300">{amount.toLocaleString()} RWF</strong>.</p>
                        <p>3. Complete request by typing your MoMo PIN.</p>
                      </div>
                    </div>
 
                    {/* Payer Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400">Payer MoMo Registered Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Jean Damascene"
                        value={momoName}
                        onChange={(e) => setMomoName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition-all font-semibold"
                      />
                      <p className="text-[10px] text-zinc-500">The full name registered under the Mobile Money phone number used.</p>
                    </div>
 
                    {/* Transaction ID */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400">Transaction ID / Reference Number</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 566832104"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                        className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition-all font-mono"
                      />
                      <p className="text-[10px] text-zinc-500">Enter the reference code from your MoMo receipt SMS to verify and authorize.</p>
                    </div>
                  </>
                )}
 
                {momoError && (
                  <p className="text-xs text-rose-400 font-medium bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-xl">
                    ⚠ {momoError}
                  </p>
                )}
 
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-semibold text-sm rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/10 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 rounded-full border border-t-white border-emerald-300 animate-spin" />
                    ) : momoSubTab === "prompt" ? (
                      "Send Prompt"
                    ) : (
                      "Verify Payment"
                    )}
                  </button>
                </div>
              </form>
            ) : momoStep === "waiting" ? (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-4 border-zinc-900" />
                  <div className={`absolute inset-0 rounded-full border-4 animate-spin ${
                    momoSubTab === "prompt" ? "border-t-emerald-500" : "border-t-amber-500"
                  }`} />
                </div>
                {momoSubTab === "prompt" ? (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-emerald-400 uppercase tracking-wide animate-pulse">Waiting for PIN entry...</p>
                    <p className="text-[11px] text-zinc-400 max-w-[320px] leading-relaxed">
                      We sent a MoMo prompt request to <strong className="text-zinc-200">{phoneNumber}</strong>.
                    </p>
                    <p className="text-[11px] text-zinc-400 max-w-[320px] leading-relaxed pt-2 border-t border-zinc-900 mt-2">
                      Please enter your PIN on your phone to authorize the payment of <strong className="text-zinc-200">{amount.toLocaleString()} RWF</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-500 uppercase tracking-wide">Pending Admin Approval</p>
                    <p className="text-[11px] text-zinc-400 max-w-[320px] leading-relaxed">
                      Transaction ID <strong className="text-zinc-200 font-mono">{transactionId}</strong> submitted under the name <strong className="text-zinc-200">{momoName}</strong>. 
                    </p>
                    <p className="text-[11px] text-zinc-400 max-w-[320px] leading-relaxed pt-2 border-t border-zinc-900 mt-2">
                      Please wait while the administrator checks the transfer and approves your submission.
                    </p>
                  </div>
                )}
              </div>
 
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl font-bold shadow-lg shadow-emerald-500/10 animate-bounce">
                  ✓
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-white">Payment Received</p>
                  <p className="text-xs text-zinc-400">Response generation will start immediately.</p>
                </div>
              </div>
            )
          ) : (
            /* Card Flow */
            <form onSubmit={handleCardSubmit} className="space-y-4">
              {/* Card Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Card Number</label>
                <input
                  type="text"
                  required
                  placeholder="4000 1234 5678 9010"
                  maxLength={19}
                  value={cardNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    const formatted = val.match(/.{1,4}/g)?.join(" ") || val;
                    setCardNumber(formatted);
                  }}
                  className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition-all font-mono"
                />
              </div>
 
              {/* Expiry & CVV */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Expiration Date</label>
                  <input
                    type="text"
                    required
                    placeholder="MM/YY"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val.length >= 2) {
                        setCardExpiry(`${val.slice(0, 2)}/${val.slice(2, 4)}`);
                      } else {
                        setCardExpiry(val);
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">CVV</label>
                  <input
                    type="password"
                    required
                    placeholder="123"
                    maxLength={3}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
 
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Cardholder Name</label>
                <input
                  type="text"
                  required
                  placeholder="Jean Damascene"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
 
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-semibold text-sm rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/10 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 rounded-full border border-t-white border-emerald-300 animate-spin" />
                  ) : (
                    `Pay ${amount.toLocaleString()} RWF`
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
