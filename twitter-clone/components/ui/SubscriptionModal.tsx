"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  X, ShieldCheck, Check, Sparkles, Clock, Lock, CreditCard, 
  RefreshCw, CheckCircle2, Ticket, Printer, ArrowRight, AlertCircle 
} from "lucide-react";
import axiosInstance from "@/lib/axiosInstance";
import { 
  isWithinPaymentWindow, 
  getPaymentWindowStatus, 
  getISTTimeString,
  formatTimeRemaining
} from "@/lib/paymentService";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalStep = "pricing" | "checkout" | "processing" | "success";

interface PlanConfig {
  id: "Bronze" | "Silver" | "Gold";
  name: string;
  price: number;
  limit: string;
  color: string;
  accent: string;
  badge: string;
  features: string[];
}

const PLANS: PlanConfig[] = [
  {
    id: "Bronze",
    name: "Bronze Plan",
    price: 100,
    limit: "Up to 3 tweets",
    color: "from-amber-700 to-amber-900 border-amber-800",
    accent: "#b45309",
    badge: "🥉 Bronze",
    features: [
      "Post up to 3 tweets",
      "Sleek Bronze profile badge",
      "Standard support"
    ]
  },
  {
    id: "Silver",
    name: "Silver Plan",
    price: 300,
    limit: "Up to 5 tweets",
    color: "from-zinc-400 to-zinc-600 border-zinc-500",
    accent: "#71717a",
    badge: "🥈 Silver",
    features: [
      "Post up to 5 tweets",
      "Sleek Silver profile badge",
      "Priority response support",
      "Unlock audio tweets"
    ]
  },
  {
    id: "Gold",
    name: "Gold Plan",
    price: 1000,
    limit: "Unlimited tweets",
    color: "from-yellow-500 via-amber-500 to-yellow-600 border-yellow-500",
    accent: "#eab308",
    badge: "🥇 Gold",
    features: [
      "Post unlimited tweets",
      "Sleek Gold profile badge",
      "24/7 dedicated support team",
      "Early beta access to new features"
    ]
  }
];

export default function SubscriptionModal({ isOpen, onClose }: SubscriptionModalProps) {
  const { user, syncUser } = useAuth();
  
  // Modal navigation states
  const [step, setStep] = useState<ModalStep>("pricing");
  const [selectedPlan, setSelectedPlan] = useState<PlanConfig | null>(null);
  
  // Time restricted payment states
  const [isGateOpen, setIsGateOpen] = useState(false);
  const [countdownText, setCountdownText] = useState("");
  const [istTime, setIstTime] = useState("");
  
  // Simulated Card Info
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [expiry, setExpiry] = useState("12/28");
  const [cvc, setCvc] = useState("•••");
  const [cardName, setCardName] = useState(user?.displayName || "Card Holder");
  
  // Checkout & Success Results
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [invoice, setInvoice] = useState<any>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  // 1. Live Payment Window ticking calculations
  useEffect(() => {
    if (!isOpen) return;

    const tick = () => {
      const status = getPaymentWindowStatus();
      setIsGateOpen(status.isOpen);
      setCountdownText(status.text);
      setIstTime(getISTTimeString());
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  // Reset modal state on exit
  const handleCloseModal = () => {
    setStep("pricing");
    setSelectedPlan(null);
    setCheckoutError("");
    setInvoice(null);
    setIsSubmitting(false);
    onClose();
  };

  // Helper: check if plan is current plan or a downgrade
  const getPlanButtonState = (planId: "Bronze" | "Silver" | "Gold") => {
    const currentPlan = user?.subscriptionPlan || "Free";
    
    if (currentPlan === planId) {
      return { disabled: true, text: "Current Plan", class: "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed" };
    }
    
    // Check downgrade
    const hierarchy = { Free: 0, Bronze: 1, Silver: 2, Gold: 3 };
    const currentVal = hierarchy[currentPlan as keyof typeof hierarchy] || 0;
    const targetVal = hierarchy[planId];
    
    if (targetVal < currentVal) {
      return { disabled: true, text: "Downgrade Blocked", class: "bg-zinc-900/50 text-zinc-650 border border-zinc-850 cursor-not-allowed" };
    }
    
    // Check time-gate lock
    if (!isGateOpen) {
      return { disabled: true, text: `Closed — ${countdownText}`, class: "bg-zinc-900 border border-zinc-850 text-zinc-500 cursor-not-allowed text-xs font-mono" };
    }

    return { 
      disabled: false, 
      text: `Upgrade to ${planId}`, 
      class: "bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold cursor-pointer transition-all shadow-[0_4px_10px_rgba(29,155,240,0.2)]" 
    };
  };

  // ── Checkout Action ───────────────────────────────────────────────────────
  
  const handleInitiateUpgrade = (plan: PlanConfig) => {
    setSelectedPlan(plan);
    setStep("checkout");
  };

  const handleProcessCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPlan || isSubmitting) return;

    setIsSubmitting(true);
    setCheckoutError("");
    setStep("processing");

    // Hold 2 seconds to make the simulated payment processing feel highly realistic
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const response = await axiosInstance.post("/payments/checkout", {
        userId: user.id,
        plan: selectedPlan.id,
        price: selectedPlan.price
      });

      if (response.data.success) {
        setInvoice(response.data.invoice || response.data.devInvoice);
        setIsDevMode(!!response.data.devInvoice);
        setStep("success");
        // Sync context state immediately
        await syncUser();
      }
    } catch (err: any) {
      console.error(err);
      setCheckoutError(err.response?.data?.message || "Simulated payment checkout failed. Please try again.");
      setStep("checkout");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      {/* Modal Dialog */}
      <div className="bg-[#030712] border border-zinc-800 w-full max-w-[620px] rounded-3xl overflow-hidden relative shadow-[0_0_60px_rgba(139,92,246,0.15)] animate-scale-up flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <header className="px-6 py-4 border-b border-zinc-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-[#8b5cf6] animate-pulse" />
            <h3 className="font-bold text-white text-base">Twiller Premium Subscriptions</h3>
          </div>
          
          <button 
            onClick={handleCloseModal}
            className="p-1.5 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </header>

        {/* Live IST clock information banner */}
        <div className="bg-zinc-950 px-6 py-2.5 border-b border-zinc-900 flex justify-between items-center text-xs">
          <span className="text-zinc-500 font-medium flex items-center gap-1 font-sans select-none">
            <Clock className="h-3.5 w-3.5 text-purple-500" /> Payment IST Window: <strong className="text-zinc-350">10:00 AM – 11:00 AM IST</strong>
          </span>
          <span className={`font-mono font-bold select-none px-2 py-0.5 rounded ${isGateOpen ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            {isGateOpen ? "🟢 Window Open" : "🔴 Closed"} · {istTime}
          </span>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col min-h-0">
          
          {/* STEP 1: PRICING CARD DECK */}
          {step === "pricing" && (
            <div className="space-y-6">
              
              {/* Promo Pitch Header */}
              <div className="text-center space-y-1">
                <h4 className="text-lg font-bold text-white leading-snug">Choose your Premium Posting Level</h4>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Expand your posting capacity and unlock visual badges by selecting a premium plan.
                </p>
              </div>

              {/* Plans horizontal scrollable deck */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map((plan) => {
                  const btnState = getPlanButtonState(plan.id);
                  return (
                    <div 
                      key={plan.id}
                      className={`rounded-2xl border bg-gradient-to-b from-zinc-950 to-zinc-900/50 p-4 flex flex-col justify-between hover:scale-[1.02] transition duration-200 ${plan.id === "Gold" ? "border-yellow-500/40 shadow-[0_0_20px_rgba(234,179,8,0.06)]" : "border-zinc-800"}`}
                    >
                      {/* Tier Info */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{plan.name}</span>
                          {user?.subscriptionPlan === plan.id && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold px-2 py-0.5 rounded border border-emerald-500/20">Current</span>
                          )}
                        </div>

                        <div className="flex items-baseline space-x-1 select-none">
                          <span className="text-2xl font-black text-white">₹{plan.price}</span>
                          <span className="text-[11px] text-zinc-500">/ month</span>
                        </div>

                        {/* Capacity warning indicator */}
                        <div className="py-1 px-2.5 rounded bg-zinc-900 border border-zinc-850 flex items-center gap-1.5 text-[11px] text-[#1d9bf0] font-semibold leading-none">
                          <Ticket className="h-3.5 w-3.5 flex-shrink-0" />
                          {plan.limit}
                        </div>

                        <div className="h-px bg-zinc-900 my-2"></div>

                        {/* Features bullet list */}
                        <ul className="space-y-1.5 text-[11.5px] text-zinc-400">
                          {plan.features.map((feat, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5 stroke-[2.5px]" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Action Upgrade button */}
                      <button
                        onClick={() => handleInitiateUpgrade(plan)}
                        disabled={btnState.disabled}
                        className={`w-full py-2 px-3 rounded-full text-xs font-bold mt-4 select-none ${btnState.class}`}
                      >
                        {btnState.text}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Time Gate restriction warning banner if closed */}
              {!isGateOpen && (
                <div className="p-3.5 bg-red-950/20 border border-red-900/30 rounded-xl flex items-start space-x-2.5 text-xs text-red-400 max-w-lg mx-auto leading-normal">
                  <Lock className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Subscription Upgrades Restricted:</strong> Outside the payment time window (10:00 AM – 11:00 AM IST), checkouts are blocked. Please return when the gate opens in <strong className="text-white font-mono">{countdownText}</strong>!
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: SIMULATED PAYMENT CHECKOUT */}
          {step === "checkout" && selectedPlan && (
            <div className="space-y-6 py-2 max-w-md mx-auto">
              
              {/* Plan Summary Card */}
              <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-xs uppercase tracking-wider">Purchase Summary</span>
                  <span className="text-white text-base font-bold mt-0.5">{selectedPlan.name} Subscription</span>
                  <span className="text-zinc-400 text-xs font-semibold mt-0.5">{selectedPlan.limit}</span>
                </div>
                <div className="flex items-baseline space-x-1 select-none">
                  <span className="text-xl font-black text-white">₹{selectedPlan.price}</span>
                  <span className="text-xs text-zinc-500">/mo</span>
                </div>
              </div>

              {/* Credit Card Simulation Form */}
              <form onSubmit={handleProcessCheckout} className="space-y-4">
                
                {/* Heading */}
                <div className="flex items-center space-x-2 text-zinc-400 text-xs font-bold uppercase tracking-wider pb-1">
                  <CreditCard className="h-4 w-4 text-[#8b5cf6]" />
                  <span>Twiller Card Sandbox Payment</span>
                </div>

                <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-4">
                  {/* Card Number */}
                  <div className="flex flex-col text-left">
                    <label className="text-zinc-500 text-xs font-semibold mb-1">Card Number</label>
                    <input 
                      type="text" 
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4242 4242 4242 4242"
                      className="bg-black border border-zinc-800 rounded-lg p-2.5 text-white text-sm outline-none focus:border-[#8b5cf6]"
                    />
                  </div>

                  {/* Expiry and CVC Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col text-left">
                      <label className="text-zinc-500 text-xs font-semibold mb-1">Expiry Date</label>
                      <input 
                        type="text" 
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                        placeholder="MM/YY"
                        className="bg-black border border-zinc-800 rounded-lg p-2.5 text-white text-sm outline-none focus:border-[#8b5cf6] text-center"
                      />
                    </div>
                    <div className="flex flex-col text-left">
                      <label className="text-zinc-500 text-xs font-semibold mb-1">CVC Code</label>
                      <input 
                        type="text" 
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value)}
                        placeholder="123"
                        className="bg-black border border-zinc-800 rounded-lg p-2.5 text-white text-sm outline-none focus:border-[#8b5cf6] text-center"
                      />
                    </div>
                  </div>

                  {/* Card Name */}
                  <div className="flex flex-col text-left">
                    <label className="text-zinc-500 text-xs font-semibold mb-1">Card Holder Name</label>
                    <input 
                      type="text" 
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="bg-black border border-zinc-800 rounded-lg p-2.5 text-white text-sm outline-none focus:border-[#8b5cf6]"
                    />
                  </div>
                </div>

                {checkoutError && (
                  <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 rounded-lg flex items-start space-x-2 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{checkoutError}</span>
                  </div>
                )}

                <div className="flex space-x-3 pt-2 select-none">
                  <button
                    type="button"
                    onClick={() => setStep("pricing")}
                    className="flex-1 bg-transparent hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white font-bold py-2.5 rounded-full text-xs transition cursor-pointer"
                  >
                    Cancel Upgrade
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold py-2.5 rounded-full text-xs transition flex items-center justify-center space-x-2 cursor-pointer shadow-[0_4px_15px_rgba(139,92,246,0.2)]"
                  >
                    <span>Confirm Simulated Payment</span>
                  </button>
                </div>

              </form>

              <div className="flex justify-center select-none text-[10.5px] text-zinc-600 gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Simulated Secure Stripe SSL Gateway</span>
              </div>
            </div>
          )}

          {/* STEP 3: TRANSACTION PROCESSING */}
          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="relative">
                <div className="h-16 w-16 border-4 border-[#8b5cf6]/20 border-t-[#8b5cf6] rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-[#8b5cf6]">
                  <CreditCard className="h-6 w-6 animate-pulse" />
                </div>
              </div>
              <div className="space-y-1.5 text-center select-none">
                <h4 className="text-white font-bold text-base">Processing Simulated Payment...</h4>
                <p className="text-zinc-500 text-xs max-w-xs mx-auto">
                  Authorizing transactional parameters against the 10:00 AM – 11:00 AM IST daily gate checks. Please wait.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS UPGRADE & INVOICE */}
          {step === "success" && invoice && selectedPlan && (
            <div className="space-y-5 text-center py-2 max-w-md mx-auto">
              
              {/* Success animations */}
              <div className="flex flex-col items-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-base font-bold text-white leading-tight">Plan Upgrade Completed Successfully!</h4>
                <p className="text-zinc-500 text-xs">
                  Your posting limits have been expanded immediately.
                </p>
              </div>

              {/* Invoice receipt display card */}
              <div className="p-5 bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-2xl space-y-4 text-left shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 h-16 w-16 bg-[#8b5cf6]/10 rounded-full blur-xl"></div>
                
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="text-white font-bold text-[14px]">🐦 Twiller Premium</h5>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Subscription Invoice</span>
                  </div>
                  <span className="text-xs bg-[#8b5cf6]/10 text-[#8b5cf6] font-bold px-2 py-0.5 rounded border border-[#8b5cf6]/20 select-none">
                    {invoice.plan} Plan
                  </span>
                </div>

                <div className="h-px bg-zinc-800"></div>

                <table className="w-full border-collapse font-sans text-xs">
                  <tbody>
                    <tr className="border-b border-zinc-900">
                      <td className="py-2 text-zinc-500">Transaction ID</td>
                      <td className="py-2 text-right font-mono text-zinc-300 select-all">{invoice.transactionId}</td>
                    </tr>
                    <tr className="border-b border-zinc-900">
                      <td className="py-2 text-zinc-500">Amount Paid</td>
                      <td className="py-2 text-right font-bold text-emerald-400">₹{invoice.price}</td>
                    </tr>
                    <tr className="border-b border-zinc-900">
                      <td className="py-2 text-zinc-500">Billing Date</td>
                      <td className="py-2 text-right text-zinc-300">{invoice.date}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-zinc-500">Customer Registered Email</td>
                      <td className="py-2 text-right text-zinc-300 truncate max-w-[150px]">{invoice.customerEmail}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Dev Mode Assist Banner */}
                {invoice.transactionId && isDevMode && (
                  <div className="p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl flex flex-col space-y-0.5 mt-2">
                    <span className="text-purple-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Ticket className="h-3 w-3 text-purple-400" /> Dev Mode Receipt
                    </span>
                    <span className="text-zinc-500 text-[10px] leading-normal font-normal">
                      SMTP credentials missing. Receipt details dispatched to console and returned here for immediate evaluation.
                    </span>
                  </div>
                )}
              </div>

              {/* Close controls */}
              <button
                onClick={handleCloseModal}
                className="w-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold py-2.5 rounded-full text-xs transition cursor-pointer select-none shadow-[0_4px_12px_rgba(139,92,246,0.3)]"
              >
                Close and Return to Feed
              </button>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
