"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  Image as ImageIcon, 
  Smile, 
  Calendar, 
  MapPin, 
  Globe2
} from "lucide-react";

interface TweetComposerProps {
  onPost: (text: string) => Promise<void> | void;
}

export default function TweetComposer({ onPost }: TweetComposerProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  
  const maxlength = 200;
  const characterCount = content.length;
  const isOverLimit = characterCount > maxlength;
  const remaining = maxlength - characterCount;
  
  // Word count validation (must type at least 2 words)
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const isTooShort = content.trim().length > 0 && wordCount <= 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isOverLimit || isTooShort || isPosting) return;

    setIsPosting(true);
    try {
      await onPost(content);
      setContent("");
    } catch (error) {
      console.error("Failed to post tweet", error);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="px-4 py-4 border-b border-zinc-800 flex space-x-3 bg-black select-none">
      
      {/* User Avatar */}
      <img
        src={user?.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=default"}
        alt={user?.displayName}
        className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800"
      />
      
      {/* Form Container */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        
        {/* Editor Area */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What is happening?!"
          className="w-full bg-transparent text-xl text-white outline-none border-none placeholder-zinc-500 resize-none h-20 py-1"
        />
        
        {/* Visibility Setting Row (Everyone can reply) */}
        <div className="flex items-center space-x-1.5 text-[#1d9bf0] text-[13px] font-bold pb-3 border-b border-zinc-900 mb-3 select-none">
          <Globe2 className="h-4 w-4" />
          <span>Everyone can reply</span>
        </div>
        
        {/* Bottom Toolbar Area */}
        <div className="flex justify-between items-center">
          
          {/* Action Icons */}
          <div className="flex space-x-1.5 text-[#1d9bf0]">
            <button type="button" className="p-2 hover:bg-zinc-900 rounded-full transition duration-150 cursor-pointer">
              <ImageIcon className="h-4.5 w-4.5" />
            </button>
            <button type="button" className="p-2 hover:bg-zinc-900 rounded-full transition duration-150 cursor-pointer">
              <Smile className="h-4.5 w-4.5" />
            </button>
            <button type="button" className="p-2 hover:bg-zinc-900 rounded-full transition duration-150 cursor-pointer">
              <Calendar className="h-4.5 w-4.5" />
            </button>
            <button type="button" className="p-2 hover:bg-zinc-900 rounded-full transition duration-150 cursor-pointer opacity-50">
              <MapPin className="h-4.5 w-4.5" />
            </button>
          </div>
          
          {/* Right Action Row: Counters, Separator, Post Button */}
          <div className="flex items-center space-x-3.5">
            
            {/* Limit Counter Circle */}
            {content.length > 0 && (
              <div className="flex items-center justify-center">
                {isOverLimit ? (
                  <span className="text-red-500 text-xs font-bold leading-none animate-pulse">
                    {remaining}
                  </span>
                ) : isTooShort ? (
                  <span className="text-zinc-500 text-[10.5px] font-semibold leading-none select-none">
                    Min 2 words
                  </span>
                ) : (
                  <span className={`text-[11px] font-semibold leading-none ${remaining <= 20 ? "text-amber-500 font-bold" : "text-zinc-500"}`}>
                    {remaining}
                  </span>
                )}
              </div>
            )}
            
            {/* Vertical Separator */}
            {content.length > 0 && (
              <div className="h-6 w-px bg-zinc-800"></div>
            )}
            
            {/* Post / Submit Button */}
            <button
              type="submit"
              disabled={!content.trim() || isOverLimit || isTooShort || isPosting}
              className="bg-[#1d9bf0] disabled:bg-[#1d9bf0]/50 hover:bg-[#1a8cd8] disabled:pointer-events-none text-white font-bold px-4 py-1.5 rounded-full text-[14.5px] transition duration-200 cursor-pointer"
            >
              {isPosting ? "Posting..." : "Post"}
            </button>
            
          </div>
          
        </div>
      </form>
      
    </div>
  );
}
