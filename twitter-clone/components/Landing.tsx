"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Authmodel from "./ui/Authmodel";

export default function Landing() {
  const { login } = useAuth();
  
  // Modal states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAuth = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  // Pre-fill login for Google / Apple quick auth demo
  const handleQuickLogin = async (email: string) => {
    setIsSubmitting(true);
    try {
      await login(email, "password123");
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row relative select-none">
      
      {/* LEFT COLUMN: Large X Logo */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-12 lg:p-24 border-b md:border-b-0 md:border-r border-zinc-900">
        <svg viewBox="0 0 24 24" className="h-28 w-28 sm:h-48 sm:w-48 md:h-72 md:w-72 lg:h-[400px] lg:w-[400px] text-white fill-current animate-fade-in">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
        </svg>
      </div>
      
      {/* RIGHT COLUMN: Action & Options */}
      <div className="flex-1 flex flex-col justify-center p-6 sm:p-12 md:p-16 lg:p-24 max-w-[650px] mx-auto md:mx-0">
        
        {/* Main Header */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tighter text-white leading-[1.05] animate-slide-up">
          Happening now
        </h1>
        
        {/* Sub Header */}
        <h2 className="text-3xl font-bold mt-10 md:mt-12 mb-8 text-white leading-snug animate-slide-up delay-100">
          Join today.
        </h2>
        
        {/* Buttons List Container */}
        <div className="flex flex-col space-y-3.5 w-full max-w-[300px] animate-slide-up delay-200">
          
          {/* Sign up with Google */}
          <button 
            disabled={isSubmitting}
            onClick={() => handleQuickLogin("google.user@gmail.com")}
            className="flex items-center justify-center space-x-2.5 bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-semibold py-2.5 px-4 rounded-full text-[14px] transition duration-200 border border-transparent shadow-sm cursor-pointer"
          >
            {isSubmitting ? (
              <div className="h-4.5 w-4.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                {/* Google G Logo SVG */}
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
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
                <span>Sign up with Google</span>
              </>
            )}
          </button>
          
          {/* Sign up with Apple */}
          <button 
            disabled={isSubmitting}
            onClick={() => handleQuickLogin("apple.user@icloud.com")}
            className="flex items-center justify-center space-x-2.5 bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-semibold py-2.5 px-4 rounded-full text-[14px] transition duration-200 border border-transparent shadow-sm cursor-pointer"
          >
            {isSubmitting ? (
              <div className="h-4.5 w-4.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                {/* Apple Logo SVG */}
                <svg className="h-4.5 w-4.5 fill-black" viewBox="0 0 170 170">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.13-1.88-14.4-6.04-3.58-2.82-7.46-7.53-11.64-14.14-10.74-17-16.11-34.82-16.11-53.48 0-14.1 3.58-25.96 10.74-35.59 7.16-9.62 16.32-14.44 27.48-14.44 4.88 0 10.13 1.41 15.75 4.23 5.62 2.82 9.4 4.23 11.34 4.23 1.62 0 5.25-1.3 10.9-3.9 5.66-2.6 10.53-3.8 15.61-3.6 16.03.76 28.21 6.84 36.52 18.23-14.2 8.57-21.2 20.3-21 35.2.22 11.27 4.28 20.73 12.19 28.36 7.9 7.63 17.5 11.75 28.8 12.36.43 2.7.98 5.6 1.65 8.7zm-27.1-105.7c0 8.02-2.93 15.22-8.79 21.6-5.86 6.37-12.98 9.95-21.36 10.72.11-7.26 3.12-14.53 9.04-21.8 5.92-7.27 13.06-11.27 21.43-12 0 .5.08 1 .08 1.48z" />
                </svg>
                <span>Sign up with Apple</span>
              </>
            )}
          </button>
          
          {/* OR separator */}
          <div className="flex items-center w-full my-2">
            <div className="h-px bg-zinc-800 flex-1"></div>
            <span className="text-[12px] text-zinc-500 font-normal px-2.5">or</span>
            <div className="h-px bg-zinc-800 flex-1"></div>
          </div>
          
          {/* Create account button */}
          <button 
            onClick={() => handleOpenAuth("signup")}
            className="bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold py-2.5 px-4 rounded-full text-[14.5px] transition duration-200 shadow-md cursor-pointer"
          >
            Create account
          </button>
          
          {/* Legal Terms Text */}
          <p className="text-[11px] text-zinc-500 leading-normal font-normal">
            By signing up, you agree to the{" "}
            <a href="#" className="text-[#1d9bf0] hover:underline">Terms of Service</a> and{" "}
            <a href="#" className="text-[#1d9bf0] hover:underline">Privacy Policy</a>, including{" "}
            <a href="#" className="text-[#1d9bf0] hover:underline">Cookie Use</a>.
          </p>
          
          {/* Already have an account container */}
          <div className="pt-10 flex flex-col space-y-4">
            <h3 className="text-base font-bold text-white">Already have an account?</h3>
            <button 
              onClick={() => handleOpenAuth("login")}
              className="bg-transparent border border-zinc-700 hover:bg-zinc-900 text-[#1d9bf0] font-bold py-2 px-4 rounded-full text-[14.5px] transition duration-200 cursor-pointer"
            >
              Log in
            </button>
          </div>
          
        </div>
      </div>
      
      {/* Dynamic Modular Authentication Modal */}
      <Authmodel 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        initialMode={authMode} 
      />
      
    </div>
  );
}
