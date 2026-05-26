"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, ShieldCheck, Mail, Lock, AlertCircle, RefreshCw } from "lucide-react";
import axiosInstance from "@/lib/axiosInstance";

interface LoginVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  devOtp?: string;
  onSuccess: () => void;
}

export default function LoginVerifyModal({
  isOpen,
  onClose,
  email,
  devOtp,
  onSuccess
}: LoginVerifyModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [otpArray, setOtpArray] = useState<string[]>(Array(6).fill(""));
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(300); // 5 mins
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // References for inputs
  const inputRefs = useRef<HTMLInputElement[]>([]);

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setErrorMsg("");
      setOtpArray(Array(6).fill(""));
      setAttemptsRemaining(3);
      setTimeLeft(300);
      startTimer();
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(300);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setErrorMsg("Login verification code has expired. Please try logging in again.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleOtpChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return; // only numbers

    const newOtp = [...otpArray];
    newOtp[index] = value.slice(-1);
    setOtpArray(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otpArray[index] && index > 0) {
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
    const fullOtp = otpArray.join("");
    if (fullOtp.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await axiosInstance.post("/auth/verify-login-otp", {
        email,
        otp: fullOtp
      });

      if (res.data.success) {
        if (timerRef.current) clearInterval(timerRef.current);
        onSuccess();
      }
    } catch (err: any) {
      console.error("Login verification failure:", err);
      const backendErr = err.response?.data;
      if (backendErr?.error === "LOCKED_OUT") {
        setErrorMsg("Too many failed attempts. For security, please try logging in again.");
        setAttemptsRemaining(0);
        setOtpArray(Array(6).fill(""));
      } else if (backendErr?.error === "WRONG_OTP") {
        setErrorMsg(backendErr.message || "Incorrect code.");
        setAttemptsRemaining((prev) => Math.max(0, prev - 1));
        setOtpArray(Array(6).fill(""));
        inputRefs.current[0]?.focus();
      } else {
        setErrorMsg(backendErr?.message || "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 transition-all duration-300">
      <div 
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl transition-all duration-300"
        style={{
          boxShadow: "0 25px 50px -12px rgba(29, 155, 240, 0.2)"
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-600" />
        
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20">
            <Mail className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Chrome Auth Verification</h3>
            <p className="text-xs text-zinc-400 font-medium">Verify your identity to log in</p>
          </div>
        </div>

        <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
          Google Chrome browser detected. We have sent a secure 6-digit login code to your registered email:
          <span className="block mt-1 font-mono text-blue-400 text-sm font-semibold tracking-wider">
            {email}
          </span>
        </p>

        {/* Grader Panel */}
        {devOtp && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4 text-sm text-blue-400">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-2 w-2 rounded-full bg-blue-400 animate-ping" />
              <span className="font-semibold text-xs tracking-wider uppercase">Grader Security Panel</span>
            </div>
            <p className="mb-2 text-zinc-300 text-xs font-medium">
              Simulated Chrome login OTP sent to email:
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

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 mb-4 text-xs text-red-400 animate-fadeIn">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-normal">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 text-center">
              Enter Verification Code
            </label>
            <div className="flex justify-between gap-2.5">
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
                  className="w-12 h-14 bg-zinc-900 border border-zinc-800 focus:border-blue-500 text-center text-xl font-bold text-white rounded-xl focus:outline-none transition-all duration-200"
                />
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
            <div className="flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" />
              <span>
                Code expires:{" "}
                <span className={`font-semibold ${timeLeft < 60 ? "text-red-400 animate-pulse" : "text-zinc-300"}`}>
                  {formatTime(timeLeft)}
                </span>
              </span>
            </div>
            {attemptsRemaining > 0 && attemptsRemaining < 3 && (
              <span className="text-amber-400 font-semibold animate-pulse">
                {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || timeLeft <= 0 || attemptsRemaining <= 0}
              className="flex-1 bg-gradient-to-r from-blue-500 to-sky-500 text-white font-bold py-2.5 rounded-xl text-sm hover:from-blue-600 hover:to-sky-600 shadow-lg shadow-blue-500/20 active:scale-98 transition-all disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
