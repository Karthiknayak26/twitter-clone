"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  Repeat2, 
  Heart, 
  BarChart2, 
  Bookmark, 
  Share, 
  MoreHorizontal, 
  CheckCircle2, 
  BookmarkCheck,
  Play,
  Pause,
  Mic,
  X
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
  tweetType?: "text" | "audio";
  audioUrl?: string;
  audioDuration?: number;
  audioFileName?: string;
}

interface TweetCardProps {
  tweet: TweetType;
  onLike: (id: string) => void;
  onRepost: (id: string) => void;
  onBookmark: (id: string) => void;
}

export default function TweetCard({ tweet, onLike, onRepost, onBookmark }: TweetCardProps) {
  const [isImageOpen, setIsImageOpen] = useState(false);
  
  // Custom audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(tweet.audioDuration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync / monitor audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setProgress(0);
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    // Initial check
    if (audio.duration && !isNaN(audio.duration)) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [tweet.audioUrl]);

  const formatnumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return num.toString();
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds === Infinity || seconds <= 0) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent clicking on tweet card navigation
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(err => console.error("Playback failed:", err));
      setIsPlaying(true);
    }
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercentage = clickX / width;
    
    audio.currentTime = clickPercentage * (audio.duration || duration);
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

          {/* Optional inline media picture card with zoom and lightbox toggle */}
          {tweet.image && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsImageOpen(true);
              }}
              className="mt-3 mb-1.5 rounded-2xl overflow-hidden border border-zinc-800/80 hover:border-zinc-700 hover:shadow-lg transition duration-200 group/image"
            >
              <img
                src={tweet.image}
                alt="Tweet image"
                className="w-full h-auto max-h-96 object-cover hover:scale-[1.01] transition-transform duration-300"
              />
            </div>
          )}

          {/* Optional premium customized Audio Player with Animated Visualizer */}
          {tweet.tweetType === "audio" && tweet.audioUrl && (
            <div 
              onClick={(e) => e.stopPropagation()} 
              className="mt-3 mb-2 p-3 bg-gradient-to-r from-zinc-950 to-zinc-900 border border-zinc-800/80 rounded-xl flex items-center space-x-3 max-w-md select-none hover:border-[#1d9bf0]/30 transition duration-200"
            >
              <audio ref={audioRef} src={tweet.audioUrl} preload="none" />
              
              {/* Play/Pause Button */}
              <button
                onClick={togglePlay}
                className="h-9 w-9 bg-[#1d9bf0] hover:bg-[#1a8cd8] rounded-full flex items-center justify-center text-white transition cursor-pointer shadow-md shrink-0"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 fill-current animate-scale-up" />
                ) : (
                  <Play className="h-4 w-4 fill-current ml-0.5 animate-scale-up" />
                )}
              </button>

              {/* Progress Slider Interface */}
              <div className="flex-1 flex flex-col space-y-1 overflow-hidden">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-semibold text-[#1d9bf0] flex items-center gap-1 font-sans">
                    <Mic className="h-3 w-3 animate-pulse" /> Voice Note
                  </span>
                  
                  {/* CSS Bouncing digital waveform audio visualizer */}
                  {isPlaying && (
                    <div className="flex items-end space-x-0.5 h-3.5 pb-0.5 select-none shrink-0" aria-hidden="true">
                      <span className="w-0.5 bg-[#1d9bf0] rounded-full animate-visualizer-1 h-3" />
                      <span className="w-0.5 bg-[#1d9bf0] rounded-full animate-visualizer-2 h-4.5" />
                      <span className="w-0.5 bg-[#1d9bf0] rounded-full animate-visualizer-3 h-2" />
                      <span className="w-0.5 bg-[#1d9bf0] rounded-full animate-visualizer-4 h-3.5" />
                    </div>
                  )}

                  {tweet.audioFileName && (
                    <span className="text-zinc-500 text-[10px] truncate max-w-[150px] font-normal">
                      · {tweet.audioFileName}
                    </span>
                  )}
                </div>
                
                <div 
                  onClick={handleProgressClick}
                  className="h-1.5 w-full bg-zinc-800 hover:h-2 rounded-full cursor-pointer overflow-hidden transition-all duration-100 relative"
                >
                  <div 
                    className="h-full bg-gradient-to-r from-[#1d9bf0] to-purple-500 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Timestamps */}
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer toolbar buttons with spring/rotation micro-interactions */}
          <div className="flex justify-between max-w-md text-zinc-500 text-xs mt-3 select-none">
            
            {/* Reply icon */}
            <button className="flex items-center space-x-2 group hover:text-[#1d9bf0] transition duration-150">
              <span className="p-1.5 group-hover:bg-[#1d9bf0]/10 rounded-full transition duration-150">
                <MessageSquare className="h-4 w-4 transition-transform duration-200 group-active:scale-120" />
              </span>
              <span className="group-hover:text-[#1d9bf0]">{formatnumber(tweet.replies)}</span>
            </button>
            
            {/* Repost button with rotating icon */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onRepost(tweet.id);
              }}
              className={`flex items-center space-x-2 group transition duration-150 ${tweet.isReposted ? "text-emerald-500" : "hover:text-emerald-500"}`}
            >
              <span className="p-1.5 group-hover:bg-emerald-500/10 rounded-full transition duration-150">
                <Repeat2 className={`h-4 w-4 transition-all duration-300 group-active:rotate-180 ${tweet.isReposted ? "stroke-[2.5px] scale-110" : ""}`} />
              </span>
              <span>{formatnumber(tweet.reposts)}</span>
            </button>
            
            {/* Like trigger heart icon with spring pop */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onLike(tweet.id);
              }}
              className={`flex items-center space-x-2 group transition duration-150 ${tweet.isLiked ? "text-pink-600" : "hover:text-pink-600"}`}
            >
              <span className="p-1.5 group-hover:bg-pink-500/10 rounded-full transition duration-150">
                <Heart className={`h-4 w-4 transition-all duration-200 group-active:scale-130 ${tweet.isLiked ? "fill-pink-600 stroke-pink-600 scale-110" : ""}`} />
              </span>
              <span>{formatnumber(tweet.likes)}</span>
            </button>
            
            {/* Views indicator */}
            <button className="flex items-center space-x-2 group hover:text-[#1d9bf0] transition duration-150">
              <span className="p-1.5 group-hover:bg-[#1d9bf0]/10 rounded-full transition duration-150">
                <BarChart2 className="h-4 w-4 transition-transform duration-200 group-active:scale-120" />
              </span>
              <span>{tweet.views}</span>
            </button>
            
            {/* Share / bookmark dropdown triggers */}
            <div className="flex space-x-1.5">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onBookmark(tweet.id);
                }}
                className={`p-1.5 rounded-full transition duration-150 ${tweet.isBookmarked ? "text-amber-500 hover:bg-amber-500/10" : "hover:text-amber-500 hover:bg-amber-500/10"}`}
              >
                {tweet.isBookmarked ? (
                  <BookmarkCheck className="h-4 w-4 fill-amber-500 stroke-amber-500 scale-110 transition-transform duration-200 active:scale-125" />
                ) : (
                  <Bookmark className="h-4 w-4 transition-transform duration-200 active:scale-125" />
                )}
              </button>
              <button className="p-1.5 hover:text-[#1d9bf0] hover:bg-[#1d9bf0]/10 rounded-full transition duration-150">
                <Share className="h-4 w-4 transition-transform duration-200 active:scale-125" />
              </button>
            </div>
            
          </div>
        </div>
      </div>

      {/* Premium Fullscreen Lightbox Modal */}
      {isImageOpen && tweet.image && (
        <div 
          onClick={() => setIsImageOpen(false)}
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 select-none animate-fade-in"
        >
          <button 
            onClick={() => setIsImageOpen(false)}
            className="absolute top-4 right-4 bg-zinc-900/60 hover:bg-zinc-800 text-white p-2 rounded-full border border-zinc-800 transition duration-150 backdrop-blur-sm shadow-lg cursor-pointer flex items-center justify-center"
            aria-label="Close fullscreen view"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="max-w-[90vw] max-h-[90vh] overflow-hidden rounded-2xl border border-zinc-850 shadow-2xl animate-scale-up">
            <img 
              src={tweet.image} 
              alt="Fullscreen view" 
              className="max-w-[90vw] max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </article>
  );
}
