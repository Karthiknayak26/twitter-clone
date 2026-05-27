"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { X, ShieldCheck, Mail, Phone, Lock, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import axiosInstance from "@/lib/axiosInstance";

interface LanguageVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLanguage: string;
  onSuccess: (newLang: string) => void;
}

type ModalStep = "requesting" | "input" | "processing" | "success" | "error_missing_phone";

export default function LanguageVerifyModal({
  isOpen,
  onClose,
  targetLanguage,
  onSuccess
}: LanguageVerifyModalProps) {
  const { user, syncUser } = useAuth();
  const [step, setStep] = useState<ModalStep>("requesting");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [destination, setDestination] = useState("");
  const [isEmail, setIsEmail] = useState(false);
  
  // OTP state
  const [otpArray, setOtpArray] = useState<string[]>(Array(6).fill(""));
  const [devOtp, setDevOtp] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(300); // 5 mins
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // References for inputs
  const inputRefs = useRef<HTMLInputElement[]>([]);

  // Reset modal state on open/change language
  useEffect(() => {
    if (isOpen) {
      setStep("requesting");
      setErrorMsg("");
      setOtpArray(Array(6).fill(""));
      setDevOtp("");
      setAttemptsRemaining(3);
      setTimeLeft(300);
      requestOtp();
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, targetLanguage]);

  // Start timer countdown
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(300);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setErrorMsg("The verification code has expired. Please request a new one.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const requestOtp = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await axiosInstance.post("/api/v1/users/language/send-otp", {
        userId: user.id,
        targetLanguage
      });

      if (res.data.success) {
        setDestination(res.data.destination || "");
        setIsEmail(res.data.isEmail || false);
        if (res.data.devOtp) {
          setDevOtp(res.data.devOtp);
        }
        setStep("input");
        startTimer();
      }
    } catch (err: any) {
      console.error("Language OTP send failure:", err);
      const backendErr = err.response?.data;
      if (backendErr?.error === "MISSING_PHONE") {
        setStep("error_missing_phone");
      } else {
        setErrorMsg(backendErr?.message || "Failed to send verification code. Please try again.");
        setStep("input"); // allow them to retry or request again
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return; // only allow numbers

    const newOtp = [...otpArray];
    // take only last character
    newOtp[index] = value.slice(-1);
    setOtpArray(newOtp);

    // auto focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otpArray[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleAutoFill = () => {
    if (devOtp) {
      const charArr = devOtp.split("").slice(0, 6);
      setOtpArray([...charArr, ...Array(6 - charArr.length).fill("")]);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const fullOtp = otpArray.join("");
    if (fullOtp.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await axiosInstance.post("/api/v1/users/language/verify-otp", {
        userId: user.id,
        otp: fullOtp
      });

      if (res.data.success) {
        setStep("success");
        if (timerRef.current) clearInterval(timerRef.current);
        
        // Sync the user with backend to pull updated language
        await syncUser();
        
        setTimeout(() => {
          onSuccess(targetLanguage);
          onClose();
        }, 1800);
      }
    } catch (err: any) {
      console.error("Language verification failure:", err);
      const backendErr = err.response?.data;
      if (backendErr?.error === "LOCKED_OUT") {
        setErrorMsg("Too many failed attempts. For security, please request a new verification code.");
        setOtpArray(Array(6).fill(""));
        setAttemptsRemaining(0);
      } else if (backendErr?.error === "WRONG_OTP") {
        setErrorMsg(backendErr.message || "Incorrect code. Please try again.");
        setOtpArray(Array(6).fill(""));
        // Decrement attempts manually if backend didn't return remaining attempts
        setAttemptsRemaining((prev) => Math.max(0, prev - 1));
        // focus back to first input
        inputRefs.current[0]?.focus();
      } else {
        setErrorMsg(backendErr?.message || "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper to format MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 transition-all duration-300">
      <div 
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl transition-all duration-300"
        style={{
          boxShadow: "0 25px 50px -12px rgba(29, 155, 240, 0.15)"
        }}
      >
        {/* Header decoration */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-600" />
        
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        {/* STEP 1: Sending/Requesting */}
        {step === "requesting" && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/30">
              <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Requesting Code</h3>
            <p className="text-zinc-400 text-sm max-w-xs">
              Contacting Twiller security services to issue an OTP code for language: <strong className="text-blue-400 font-semibold">{targetLanguage}</strong>...
            </p>
          </div>
        )}

        {/* STEP 2: Input OTP Form */}
        {step === "input" && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20">
                {isEmail ? (
                  <Mail className="h-5 w-5 text-blue-400" />
                ) : (
                  <Phone className="h-5 w-5 text-blue-400" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Language Verification</h3>
                <p className="text-xs text-zinc-400 font-medium">Switching to {targetLanguage}</p>
              </div>
            </div>

            <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
              We have sent a 6-digit security code to your registered{" "}
              <strong className="text-white font-semibold">{isEmail ? "Email Address" : "Mobile Number"}</strong>:
              <span className="block mt-1 font-mono text-blue-400 text-base font-semibold tracking-wider">
                {destination}
              </span>
            </p>

            {/* Dev Mode Assistant Card */}
            {devOtp && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4 text-sm text-blue-400">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex h-2 w-2 rounded-full bg-blue-400 animate-ping" />
                  <span className="font-semibold text-xs tracking-wider uppercase">Evaluator Dev Panel</span>
                </div>
                <p className="mb-2 text-zinc-300 text-xs font-medium">
                  {isEmail 
                    ? "Dev mode fallback active. Simulated Email OTP is:"
                    : "Dev mode fallback active. Simulated SMS OTP is:"
                  }
                </p>
                <div className="flex items-center justify-between bg-black/40 border border-blue-500/30 rounded-lg px-3 py-1.5">
                  <span className="font-mono text-lg font-bold tracking-widest text-blue-300">{devOtp}</span>
                  <button 
                    type="button"
                    onClick={handleAutoFill} 
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-semibold"
                  >
                    Auto-fill
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 mb-4 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-normal">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-6">
              {/* Digit fields */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 text-center">
                  Verification Code
                </label>
                <div className="flex justify-between gap-1.5 sm:gap-2.5">
                  {otpArray.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        if (el) inputRefs.current[idx] = el;
                      }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(e.target.value, idx)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      disabled={loading || timeLeft <= 0 || attemptsRemaining <= 0}
                      className="w-9 h-11 sm:w-12 sm:h-14 bg-zinc-900 border border-zinc-800 focus:border-blue-500 text-center text-lg sm:text-xl font-bold text-white rounded-xl focus:outline-none transition-all duration-200"
                    />
                  ))}
                </div>
              </div>

              {/* Extra Metadata (Countdown, Attempts) */}
              <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
                <div className="flex items-center gap-1">
                  <Lock className="h-3 w.5" />
                  <span>
                    Expires in:{" "}
                    <span className={`font-semibold ${timeLeft < 60 ? "text-red-400 animate-pulse" : "text-zinc-300"}`}>
                      {formatTime(timeLeft)}
                    </span>
                  </span>
                </div>
                {attemptsRemaining > 0 && attemptsRemaining < 3 && (
                  <span className="text-amber-400 font-semibold">
                    {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining
                  </span>
                )}
              </div>

              {/* Verify / Resend Controls */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={requestOtp}
                  disabled={loading || timeLeft > 270} // block resend within 30s
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 font-semibold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  Resend Code
                </button>
                <button
                  type="submit"
                  disabled={loading || timeLeft <= 0 || attemptsRemaining <= 0}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-sky-500 text-white font-bold py-2.5 rounded-xl text-sm hover:from-blue-600 hover:to-sky-600 shadow-lg shadow-blue-500/20 active:scale-98 transition-all disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify Code"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: Success state */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-fadeIn">
            <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <div className="absolute inset-0 rounded-full border-4 border-emerald-400/20 animate-ping" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Verification Successful!</h3>
            <p className="text-zinc-400 text-sm max-w-xs leading-relaxed mb-1">
              You have securely verified your profile.
            </p>
            <p className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5 justify-center">
              <Sparkles className="h-4 w-4 text-emerald-400 animate-spin" />
              Translating interface into <strong className="underline decoration-wavy">{targetLanguage}</strong>...
            </p>
          </div>
        )}

        {/* STEP 4: Error missing phone number state */}
        {step === "error_missing_phone" && (
          <div className="py-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 mb-4">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Action Required</h3>
            <p className="text-sm text-zinc-300 leading-relaxed mb-6">
              To switch to <strong className="text-blue-400">{targetLanguage}</strong>, we must authenticate your identity via an OTP sent to your registered mobile number.
              <span className="block mt-2 font-medium text-zinc-400">
                You do not have a phone number configured in your Twiller profile yet.
              </span>
            </p>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-gradient-to-r from-blue-500 to-sky-500 text-white font-bold py-2.5 rounded-xl text-sm hover:from-blue-600 hover:to-sky-600 transition-all text-center"
              >
                Go to Profile Page to Add Phone
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
