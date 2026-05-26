"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { X, User, Mail, Lock, Eye, EyeOff } from "lucide-react";

interface AuthModelProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: "login" | "signup";
}

export default function Authmodel({ isOpen, onClose, initialMode }: AuthModelProps) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    displayName: "",
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync mode with prop
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setFormData({ email: "", password: "", username: "", displayName: "" });
      setErrors({});
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }
    
    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    
    if (mode === "signup") {
      if (!formData.username.trim()) {
        newErrors.username = "Username is required";
      } else if (formData.username.length < 3) {
        newErrors.username = "Username must be at least 3 characters";
      } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        newErrors.username = "Username can only contain letters, numbers, and underscores";
      }
      
      if (!formData.displayName.trim()) {
        newErrors.displayName = "Display name is required";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await login(formData.email, formData.password);
      } else {
        await signup(formData.email, formData.password, formData.username, formData.displayName);
      }
      onClose();
      setFormData({ email: "", password: "", username: "", displayName: "" });
      setErrors({});
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setErrors({});
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-black border border-zinc-800 w-full max-w-[440px] rounded-2xl p-6 sm:p-7 relative shadow-2xl animate-scale-up text-left">
        
        {/* Close Button in top right */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-1 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition cursor-pointer"
        >
          <X className="h-4.5 w-4.5" />
        </button>
        
        {/* Centered X Logo */}
        <div className="flex justify-center mb-4">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-white fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
          </svg>
        </div>
        
        {/* Title */}
        <h2 className="text-[22px] font-bold text-white text-center mb-6">
          {mode === "login" ? "Sign in to X" : "Create your account"}
        </h2>
        
        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Display Name (Only in Sign Up Mode) */}
          {mode === "signup" && (
            <div className="flex flex-col">
              <label className="text-zinc-400 text-[13px] font-semibold mb-1.5 ml-0.5">Display Name</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                  <User className="h-4.5 w-4.5" />
                </span>
                <input
                  type="text"
                  placeholder="Your display name"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange("displayName", e.target.value)}
                  className={`w-full bg-black border ${errors.displayName ? "border-red-500 focus:border-red-500" : "border-zinc-800 focus:border-[#1d9bf0]"} rounded-lg py-2.5 pl-10 pr-4 text-white text-sm outline-none transition duration-150 placeholder-zinc-600`}
                />
              </div>
              {errors.displayName && (
                <span className="text-red-500 text-xs mt-1 ml-0.5">{errors.displayName}</span>
              )}
            </div>
          )}

          {/* Username (Only in Sign Up Mode) */}
          {mode === "signup" && (
            <div className="flex flex-col">
              <label className="text-zinc-400 text-[13px] font-semibold mb-1.5 ml-0.5">Username</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm select-none">
                  @
                </span>
                <input
                  type="text"
                  placeholder="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  className={`w-full bg-black border ${errors.username ? "border-red-500 focus:border-red-500" : "border-zinc-800 focus:border-[#1d9bf0]"} rounded-lg py-2.5 pl-8 pr-4 text-white text-sm outline-none transition duration-150 placeholder-zinc-600`}
                />
              </div>
              {errors.username && (
                <span className="text-red-500 text-xs mt-1 ml-0.5">{errors.username}</span>
              )}
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col">
            <label className="text-zinc-400 text-[13px] font-semibold mb-1.5 ml-0.5">Email</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                <Mail className="h-4.5 w-4.5" />
              </span>
              <input
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className={`w-full bg-black border ${errors.email ? "border-red-500 focus:border-red-500" : "border-zinc-800 focus:border-[#1d9bf0]"} rounded-lg py-2.5 pl-10 pr-4 text-white text-sm outline-none transition duration-150 placeholder-zinc-600`}
              />
            </div>
            {errors.email && (
              <span className="text-red-500 text-xs mt-1 ml-0.5">{errors.email}</span>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col">
            <label className="text-zinc-400 text-[13px] font-semibold mb-1.5 ml-0.5">Password</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                <Lock className="h-4.5 w-4.5" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                className={`w-full bg-black border ${errors.password ? "border-red-500 focus:border-red-500" : "border-zinc-800 focus:border-[#1d9bf0]"} rounded-lg py-2.5 pl-10 pr-10 text-white text-sm outline-none transition duration-150 placeholder-zinc-600`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
            {errors.password && (
              <span className="text-red-500 text-xs mt-1 ml-0.5">{errors.password}</span>
            )}
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold py-2.5 rounded-full text-sm transition duration-200 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none mt-2"
          >
            {isSubmitting ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>{mode === "login" ? "Sign in" : "Create account"}</span>
            )}
          </button>
          
          {/* OR Divider */}
          <div className="flex items-center w-full my-2 select-none">
            <div className="h-px bg-zinc-800 flex-1"></div>
            <span className="text-[11px] text-zinc-500 font-normal px-2.5">OR</span>
            <div className="h-px bg-zinc-800 flex-1"></div>
          </div>
          
          {/* Switch Mode Redirect Link */}
          <p className="text-[13px] text-zinc-400 text-center font-normal">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={switchMode}
              className="text-[#1d9bf0] font-semibold hover:underline bg-transparent border-none cursor-pointer"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
          
          {/* Legal Terms Text at Bottom (Only in Sign Up Mode) */}
          {mode === "signup" && (
            <p className="text-[10.5px] text-zinc-500 leading-normal text-center font-normal pt-2">
              By signing up, you agree to our{" "}
              <a href="#" className="text-zinc-400 hover:underline">Terms of Service</a> and{" "}
              <a href="#" className="text-zinc-400 hover:underline">Privacy Policy</a>, including{" "}
              <a href="#" className="text-zinc-400 hover:underline">Cookie Use</a>.
            </p>
          )}
          
        </form>
      </div>
    </div>
  );
}
