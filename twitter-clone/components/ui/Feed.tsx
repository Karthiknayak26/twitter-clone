"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Sparkles } from "lucide-react";
import TweetCard, { TweetType } from "./TweetCard";
import TweetComposer from "./TweetComposer";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import axiosInstance from "@/lib/axiosInstance";

export default function Feed() {
  const { user } = useAuth();
  
  // Local state for tweets (initialized with mock data or Express entries)
  const [tweets, setTweets] = useState<TweetType[]>([]);
  const [activeTab, setActiveTab] = useState<"for-you" | "following">("for-you");

  // Format timestamp helper
  const formatTime = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const mapBackendTweetToFrontend = (tweet: any, currentUserId?: string): TweetType => {
    const likedBy = tweet.likedBy || [];
    const repostedBy = tweet.repostedBy || [];
    const bookmarkedBy = tweet.bookmarkedBy || [];
    
    return {
      id: tweet.id || tweet._id,
      user: {
        displayName: tweet.user?.displayName || "Anonymous",
        username: tweet.user?.username || "anonymous",
        avatar: tweet.user?.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=anon",
        isVerified: tweet.user?.isVerified !== undefined ? tweet.user.isVerified : true
      },
      content: tweet.content || "",
      image: tweet.image,
      time: tweet.createdAt ? formatTime(new Date(tweet.createdAt)) : "Just now",
      likes: likedBy.length,
      replies: tweet.replies || 0,
      reposts: repostedBy.length,
      views: tweet.views || "1",
      isLiked: currentUserId ? likedBy.includes(currentUserId) : false,
      isReposted: currentUserId ? repostedBy.includes(currentUserId) : false,
      isBookmarked: currentUserId ? bookmarkedBy.includes(currentUserId) : false
    };
  };

  const fetchTweets = async () => {
    try {
      const res = await axiosInstance.get("/post");
      if (res.data) {
        const mapped = res.data.map((t: any) => mapBackendTweetToFrontend(t, user?.id));
        setTweets(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch tweets from backend:", err);
    }
  };

  // Live Query & Poll Mode: Load tweets on mount/user-change and poll every 4 seconds to keep updated
  useEffect(() => {
    fetchTweets();
    const interval = setInterval(fetchTweets, 4000);
    return () => clearInterval(interval);
  }, [user]);

  const handleComposerPost = async (text: string) => {
    if (!user) return;

    try {
      const payload = {
        content: text,
        user: {
          displayName: user.displayName,
          username: user.username,
          avatar: user.avatar,
          isVerified: true
        }
      };
      const res = await axiosInstance.post("/post", payload);
      if (res.data) {
        await fetchTweets();
      }
    } catch (error) {
      console.error("Failed to post tweet to Express backend:", error);
    }
  };

  const handleLike = async (id: string) => {
    if (!user) return;

    // Optimistic UI updates
    setTweets(prev => prev.map(tweet => {
      if (tweet.id === id) {
        return {
          ...tweet,
          likes: tweet.isLiked ? tweet.likes - 1 : tweet.likes + 1,
          isLiked: !tweet.isLiked
        };
      }
      return tweet;
    }));

    try {
      await axiosInstance.post(`/post/${id}/like`, { userId: user.id });
      fetchTweets();
    } catch (error) {
      console.error("Like toggle failure:", error);
    }
  };

  const handleRepost = async (id: string) => {
    if (!user) return;

    // Optimistic UI updates
    setTweets(prev => prev.map(tweet => {
      if (tweet.id === id) {
        return {
          ...tweet,
          reposts: tweet.isReposted ? tweet.reposts - 1 : tweet.reposts + 1,
          isReposted: !tweet.isReposted
        };
      }
      return tweet;
    }));

    try {
      await axiosInstance.post(`/post/${id}/repost`, { userId: user.id });
      fetchTweets();
    } catch (error) {
      console.error("Repost toggle failure:", error);
    }
  };

  const handleBookmark = async (id: string) => {
    if (!user) return;

    // Optimistic UI updates
    setTweets(prev => prev.map(tweet => {
      if (tweet.id === id) {
        return {
          ...tweet,
          isBookmarked: !tweet.isBookmarked
        };
      }
      return tweet;
    }));

    try {
      await axiosInstance.post(`/post/${id}/bookmark`, { userId: user.id });
      fetchTweets();
    } catch (error) {
      console.error("Bookmark toggle failure:", error);
    }
  };

  return (
    <div className="bg-black text-white w-full select-none">
      
      {/* Feed Sticky Tabs Header */}
      <header className="sticky top-0 bg-black/85 backdrop-blur-md border-b border-zinc-800 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Home</h1>
          <Sparkles className="h-5 w-5 text-zinc-400 hover:text-[#1d9bf0] transition duration-200 cursor-pointer" />
        </div>

        {/* Tab selection lines */}
        <div className="flex border-t border-zinc-900 w-full text-center">
          <button 
            onClick={() => setActiveTab("for-you")} 
            className="flex-1 py-4 font-semibold text-sm hover:bg-zinc-900/50 transition duration-200 relative"
          >
            <span className={`inline-block pb-3 ${activeTab === "for-you" ? "text-white font-bold relative" : "text-zinc-500 font-medium"}`}>
              For you
              {activeTab === "for-you" && (
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#1d9bf0] rounded-full"></span>
              )}
            </span>
          </button>
          <button 
            onClick={() => setActiveTab("following")} 
            className="flex-1 py-4 font-semibold text-sm hover:bg-zinc-900/50 transition duration-200 relative"
          >
            <span className={`inline-block pb-3 ${activeTab === "following" ? "text-white font-bold relative" : "text-zinc-500 font-medium"}`}>
              Following
              {activeTab === "following" && (
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#1d9bf0] rounded-full"></span>
              )}
            </span>
          </button>
        </div>
      </header>

      {/* Tweet Composer Box */}
      <TweetComposer onPost={handleComposerPost} />

      {/* Tweets scrollable list */}
      <div className="divide-y divide-zinc-800">
        {tweets.map((tweet) => (
          <TweetCard 
            key={tweet.id}
            tweet={tweet}
            onLike={handleLike}
            onRepost={handleRepost}
            onBookmark={handleBookmark}
          />
        ))}
      </div>

    </div>
  );
}
