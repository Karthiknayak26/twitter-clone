"use client";

import React, { useState } from "react";
import { Search, X, MoreHorizontal, CheckCircle2, TrendingUp } from "lucide-react";

export default function Rightsidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});

  const toggleFollow = (username: string) => {
    setFollowingStates(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  return (
    <aside className="hidden lg:block w-80 xl:w-96 pl-6 xl:pl-8 py-3 space-y-4 sticky h-screen overflow-y-auto top-0 select-none bg-black">
      
      {/* Search bar */}
      <div className="bg-zinc-900 border border-transparent focus-within:border-[#1d9bf0] focus-within:bg-black rounded-full flex items-center px-4 py-2.5 space-x-3 transition duration-150">
        <Search className="h-4.5 w-4.5 text-zinc-500" />
        <input
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent text-white placeholder-zinc-500 outline-none w-full text-sm font-normal"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery("")} 
            className="text-zinc-500 hover:text-white p-0.5 rounded-full bg-zinc-800 transition duration-150 cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Premium Subscription Card */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4 space-y-2">
        <h2 className="text-lg font-extrabold text-white tracking-tight">Subscribe to Premium</h2>
        <p className="text-[14px] text-zinc-300 font-normal leading-normal">
          Subscribe to unlock new features and if eligible, receive a share of ads revenue.
        </p>
        <button className="bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-extrabold px-4 py-2 rounded-full text-sm transition duration-200 cursor-pointer shadow-md">
          Subscribe
        </button>
      </div>

      {/* Trends - What's Happening */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-900">
          <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#1d9bf0]" />
            What's happening
          </h2>
        </div>
        
        <div className="divide-y divide-zinc-900">
          {[
            { category: "Technology · Trending", topic: "#React19", posts: "24.5K posts" },
            { category: "World News · Trending", topic: "SpaceX Starship", posts: "89.2K posts" },
            { category: "Web Design · Trending", topic: "Tailwind CSS v4", posts: "12.8K posts" },
            { category: "Entertainment · Trending", topic: "Oscars 2026", posts: "154K posts" },
            { category: "Software · Trending", topic: "Next.js App Router", posts: "45.1K posts" },
          ].map((trend, i) => (
            <div key={i} className="px-4 py-3 hover:bg-zinc-900/40 transition duration-150 cursor-pointer flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[12px] text-zinc-500 font-normal block">{trend.category}</span>
                <span className="text-[14.5px] text-white font-bold block">{trend.topic}</span>
                <span className="text-[12px] text-zinc-500 font-normal block">{trend.posts}</span>
              </div>
              <MoreHorizontal className="h-4 w-4 text-zinc-500 hover:text-white cursor-pointer" />
            </div>
          ))}
        </div>
      </div>

      {/* You Might Like */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-900">
          <h2 className="text-lg font-extrabold text-white tracking-tight">You might like</h2>
        </div>
        
        <div className="divide-y divide-zinc-900">
          {[
            { name: "Narendra Modi", username: "narendramodi", avatar: "https://api.dicebear.com/7.x/pixel-art/svg?seed=modi", verified: true },
            { name: "Akshay Kumar", username: "akshaykumar", avatar: "https://api.dicebear.com/7.x/pixel-art/svg?seed=akshay", verified: true },
            { name: "President of India", username: "rashtrapatibhvn", avatar: "https://api.dicebear.com/7.x/pixel-art/svg?seed=president", verified: true },
          ].map((rec, i) => {
            const isFollowing = !!followingStates[rec.username];
            return (
              <div key={i} className="px-4 py-3 hover:bg-zinc-900/40 transition duration-150 cursor-pointer flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src={rec.avatar}
                    alt={rec.name}
                    className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800"
                  />
                  <div className="flex flex-col text-left text-xs leading-tight">
                    <span className="font-bold text-white hover:underline flex items-center gap-1">
                      {rec.name}
                      {rec.verified && (
                        <CheckCircle2 className="h-3.5 w-3.5 fill-[#1d9bf0] text-black stroke-[1.5]" />
                      )}
                    </span>
                    <span className="text-zinc-500">@{rec.username}</span>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFollow(rec.username);
                  }}
                  className={`font-bold px-4 py-1.5 rounded-full text-xs transition duration-150 cursor-pointer ${
                    isFollowing 
                      ? "bg-transparent border border-zinc-650 text-white hover:border-red-500 hover:text-red-500" 
                      : "bg-white text-black hover:bg-zinc-200"
                  }`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Links */}
      <footer className="px-4 text-[12.5px] text-zinc-500 leading-normal font-normal space-y-1">
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
          <a href="#" className="hover:underline">Terms of Service</a>
          <a href="#" className="hover:underline">Privacy Policy</a>
          <a href="#" className="hover:underline">Cookie Policy</a>
        </div>
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
          <a href="#" className="hover:underline">Accessibility</a>
          <a href="#" className="hover:underline">Ads info</a>
          <span>© 2026 X Corp.</span>
        </div>
      </footer>
      
    </aside>
  );
}
