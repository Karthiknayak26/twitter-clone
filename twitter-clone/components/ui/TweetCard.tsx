"use client";

import React from "react";
import { 
  MessageSquare, 
  Repeat2, 
  Heart, 
  BarChart2, 
  Bookmark, 
  Share, 
  MoreHorizontal, 
  CheckCircle2, 
  BookmarkCheck 
} from "lucide-react";

export interface TweetType {
  id: string;
  user: {
    displayName: string;
    username: string;
    avatar: string;
    isVerified: boolean;
  };
  content: string;
  time: string;
  likes: number;
  replies: number;
  reposts: number;
  views: string;
  isLiked: boolean;
  isReposted: boolean;
  isBookmarked: boolean;
  image?: string;
}

interface TweetCardProps {
  tweet: TweetType;
  onLike: (id: string) => void;
  onRepost: (id: string) => void;
  onBookmark: (id: string) => void;
}

export default function TweetCard({ tweet, onLike, onRepost, onBookmark }: TweetCardProps) {
  
  const formatnumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return num.toString();
  };

  return (
    <article className="p-4 hover:bg-zinc-900/30 transition duration-150 cursor-pointer border-b border-zinc-800">
      <div className="flex space-x-3">
        
        {/* User Profile Avatar */}
        <img
          src={tweet.user.avatar}
          alt={tweet.user.displayName}
          className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800"
        />
        
        {/* Core Card Contents */}
        <div className="flex-1">
          
          {/* Header information */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-sm">
              <span className="font-bold text-white hover:underline flex items-center gap-1 leading-tight">
                {tweet.user.displayName}
                {tweet.user.isVerified && (
                  <CheckCircle2 className="h-4 w-4 fill-[#1d9bf0] text-black stroke-[1.5]" />
                )}
              </span>
              <span className="text-zinc-500 font-normal">@{tweet.user.username}</span>
              <span className="text-zinc-500 font-normal">·</span>
              <span className="text-zinc-500 font-normal hover:underline">{tweet.time}</span>
            </div>
            
            {/* Context dropdown option */}
            <button className="text-zinc-500 hover:text-[#1d9bf0] p-1.5 hover:bg-[#1d9bf0]/10 rounded-full transition duration-150">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Text content area */}
          <p className="text-[15px] text-zinc-100 mt-1.5 leading-normal whitespace-pre-line font-normal break-words">
            {tweet.content}
          </p>

          {/* Optional inline media picture card */}
          {tweet.image && (
            <div className="mt-3 mb-1.5 rounded-2xl overflow-hidden border border-zinc-800">
              <img
                src={tweet.image}
                alt="Tweet image"
                className="w-full h-auto max-h-96 object-cover"
              />
            </div>
          )}

          {/* Footer toolbar buttons */}
          <div className="flex justify-between max-w-md text-zinc-500 text-xs mt-3 select-none">
            
            {/* Reply icon */}
            <button className="flex items-center space-x-2 group hover:text-[#1d9bf0] transition duration-150">
              <span className="p-1.5 group-hover:bg-[#1d9bf0]/10 rounded-full transition duration-150">
                <MessageSquare className="h-4 w-4" />
              </span>
              <span className="group-hover:text-[#1d9bf0]">{formatnumber(tweet.replies)}</span>
            </button>
            
            {/* Repost button */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onRepost(tweet.id);
              }}
              className={`flex items-center space-x-2 group transition duration-150 ${tweet.isReposted ? "text-emerald-500" : "hover:text-emerald-500"}`}
            >
              <span className="p-1.5 group-hover:bg-emerald-500/10 rounded-full transition duration-150">
                <Repeat2 className={`h-4 w-4 ${tweet.isReposted ? "stroke-[2.5px]" : ""}`} />
              </span>
              <span>{formatnumber(tweet.reposts)}</span>
            </button>
            
            {/* Like trigger heart icon */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onLike(tweet.id);
              }}
              className={`flex items-center space-x-2 group transition duration-150 ${tweet.isLiked ? "text-pink-600" : "hover:text-pink-600"}`}
            >
              <span className="p-1.5 group-hover:bg-pink-500/10 rounded-full transition duration-150">
                <Heart className={`h-4 w-4 ${tweet.isLiked ? "fill-pink-600 stroke-pink-600" : ""}`} />
              </span>
              <span>{formatnumber(tweet.likes)}</span>
            </button>
            
            {/* Views indicator */}
            <button className="flex items-center space-x-2 group hover:text-[#1d9bf0] transition duration-150">
              <span className="p-1.5 group-hover:bg-[#1d9bf0]/10 rounded-full transition duration-150">
                <BarChart2 className="h-4 w-4" />
              </span>
              <span>{tweet.views}</span>
            </button>
            
            {/* Share / bookmark dropdown trigger */}
            <div className="flex space-x-1.5">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onBookmark(tweet.id);
                }}
                className={`p-1.5 rounded-full transition duration-150 ${tweet.isBookmarked ? "text-amber-500 hover:bg-amber-500/10" : "hover:text-amber-500 hover:bg-amber-500/10"}`}
              >
                {tweet.isBookmarked ? (
                  <BookmarkCheck className="h-4 w-4 fill-amber-500 stroke-amber-500" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </button>
              <button className="p-1.5 hover:text-[#1d9bf0] hover:bg-[#1d9bf0]/10 rounded-full transition duration-150">
                <Share className="h-4 w-4" />
              </button>
            </div>
            
          </div>
        </div>
      </div>
    </article>
  );
}
