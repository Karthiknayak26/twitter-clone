"use client";

import React, { useState } from "react";
import { ArrowLeft, Key, Mail, Phone, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import axiosInstance from "@/lib/axiosInstance";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Success states
  const [success, setSuccess] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [devPassword, setDevPassword] = useState(""); // captured in dev-mode when EMAIL_USER is not configured

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMsg("");
    setSuccess(false);
    setDevPassword("");

    try {
      const response = await axiosInstance.post("/forgot-password/request", {
        identifier: identifier.trim()
      });

      if (response.data.success) {
        setSuccess(true);
        setMaskedEmail(response.data.maskedEmail);
        
        // Show generated password in Dev Mode (if returned in payload)
        if (response.data.devPassword) {
          setDevPassword(response.data.devPassword);
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || "Failed to initiate password reset. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 select-none">
      <div className="bg-black border border-zinc-800 w-full max-w-[460px] rounded-2xl p-6 sm:p-8 relative shadow-2xl animate-scale-up text-left">
        
        {/* Top Header & Back Button */}
        <div className="flex items-center space-x-3 mb-6">
          <a 
            href="/"
            className="p-1.5 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition cursor-pointer"
            title="Back to login"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </a>
          <h2 className="text-xl font-bold text-white">Find your account</h2>
        </div>

        {/* Centered SVG Logo */}
        <div className="flex justify-center mb-6">
          <svg viewBox="0 0 24 24" className="h-10 w-10 text-white fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
          </svg>
        </div>

        {!success ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400 leading-normal font-normal">
              Enter your registered **email address** or **phone number** to reset your password. 
              <br />
              <span className="text-zinc-500 text-xs">Note: Account recovery is permitted only once per day.</span>
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Identifier Input */}
              <div className="flex flex-col">
                <label className="text-zinc-400 text-[13px] font-semibold mb-1.5 ml-0.5">Email or Phone Number</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                    {identifier.includes("@") ? (
                      <Mail className="h-4.5 w-4.5" />
                    ) : (
                      <Phone className="h-4.5 w-4.5" />
                    )}
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Enter email or phone number"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className={`w-full bg-black border ${errorMsg ? "border-red-500 focus:border-red-500" : "border-zinc-800 focus:border-[#1d9bf0]"} rounded-lg py-2.5 pl-10 pr-4 text-white text-sm outline-none transition duration-150 placeholder-zinc-650`}
                  />
                </div>
              </div>

              {/* Error Box */}
              {errorMsg && (
                <div className="p-3 bg-red-950/30 border border-red-900/50 text-red-450 rounded-lg flex items-start space-x-2 text-sm leading-relaxed">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-red-450" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !identifier.trim()}
                className="w-full bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-bold py-2.5 rounded-full text-sm transition duration-200 flex items-center justify-center space-x-2 cursor-pointer disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <span>Search</span>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6 text-center py-2">
            <div className="flex flex-col items-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Password Reset Successful</h3>
            </div>

            <p className="text-sm text-zinc-400 leading-normal max-w-sm mx-auto font-normal">
              A temporary password has been successfully dispatched to the email associated with this account:
              <br />
              <strong className="text-zinc-200 font-semibold">{maskedEmail}</strong>
            </p>

            {/* Dev Mode Helper Card */}
            {devPassword && (
              <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl flex flex-col items-center space-y-2 select-all max-w-sm mx-auto shadow-md">
                <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  <Key className="h-3.5 w-3.5 text-[#1d9bf0]" /> Temporary Password
                </span>
                <span className="font-mono text-[#1d9bf0] text-xl font-black select-all pt-1 tracking-wider">
                  {devPassword}
                </span>
                <span className="text-zinc-650 text-[10px] text-center font-normal leading-normal">
                  SMTP is not set up on this server environment.<br />Use this generated letters-only password to log in.
                </span>
              </div>
            )}

            <div className="space-y-3 pt-3">
              <a
                href="/"
                className="w-full bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold py-2.5 rounded-full text-sm transition duration-200 flex items-center justify-center cursor-pointer"
              >
                Log In Now
              </a>
              <button
                onClick={() => {
                  setSuccess(false);
                  setIdentifier("");
                  setDevPassword("");
                  setErrorMsg("");
                }}
                className="w-full bg-transparent hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white font-bold py-2 rounded-full text-sm transition cursor-pointer"
              >
                Reset Another Account
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
