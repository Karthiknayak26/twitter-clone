"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "./Sidebar";
import Rightsidebar from "./Rightsidebar";
import Feed from "../ui/Feed";
import Profile from "../ui/Profile";
import LoadingSpinner from "../ui/loading-spinner";

export default function Mainlayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState("home");

  // Splash Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center select-none">
        <div className="text-center flex flex-col items-center">
          <svg viewBox="0 0 24 24" className="h-16 w-16 text-white fill-current mb-6 animate-pulse">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
          </svg>
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  // If not logged in, render the landing page (which is the child of page.tsx)
  if (!user) {
    return <div className="min-h-screen bg-black text-white">{children}</div>;
  }

  // If logged in, render the main dashboard layout
  return (
    <div className="min-h-screen bg-black text-white flex justify-center font-sans antialiased">
      <div className="flex w-full max-w-7xl px-0 md:px-4">
        
        {/* ================= LEFT COLUMN: Sidebar Navigation ================= */}
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

        {/* ================= MIDDLE COLUMN: Main Panel Content ================= */}
        <main className="flex-1 max-w-[600px] border-r border-zinc-800 min-h-screen">
          
          {currentPage === "home" && (
            <Feed />
          )}

          {/* Profile Page View */}
          {currentPage === "profile" && (
            <Profile onBack={() => setCurrentPage("home")} />
          )}

          {/* Muted Navigation Panels */}
          {["explore", "notifications", "messages", "bookmarks"].includes(currentPage) && (
            <div className="min-h-screen">
              <header className="sticky top-0 bg-black/80 backdrop-blur-md border-b border-zinc-800 z-10 px-4 py-3">
                <h1 className="text-xl font-bold tracking-tight capitalize">{currentPage}</h1>
              </header>
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-3 select-none">
                <h2 className="text-lg font-bold text-white tracking-tight">Explore the X universe</h2>
                <p className="text-zinc-500 text-sm max-w-xs font-normal">
                  This page's interactive modules will be fully loaded in the next updates. Try the Feed or Profile!
                </p>
              </div>
            </div>
          )}

        </main>

        {/* ================= RIGHT COLUMN: Widgets Column ================= */}
        <Rightsidebar />

      </div>
    </div>
  );
}
