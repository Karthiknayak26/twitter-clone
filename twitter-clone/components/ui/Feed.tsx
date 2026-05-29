"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/lib/i18n";
import { Sparkles } from "lucide-react";
import TweetCard, { TweetType } from "./TweetCard";
import TweetComposer from "./TweetComposer";
import axiosInstance from "@/lib/axiosInstance";
import { containsKeywords, sendTweetNotification, areNotificationsActive } from "@/lib/notificationService";
import SubscriptionModal from "./SubscriptionModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/context/SocketProvider";

export default function Feed() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();
  
  const [activeTab, setActiveTab] = useState<"for-you" | "following">("for-you");
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

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
      isBookmarked: currentUserId ? bookmarkedBy.includes(currentUserId) : false,
      tweetType: tweet.tweetType || "text",
      audioUrl: tweet.audioUrl,
      audioDuration: tweet.audioDuration,
      audioFileName: tweet.audioFileName
    };
  };

  // Fetch initial tweets using React Query
  const { data: tweets = [], isLoading } = useQuery({
    queryKey: ['tweets'],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/tweets");
      const fetchedTweets = res.data?.data?.tweets || [];
      return fetchedTweets.map((t: any) => mapBackendTweetToFrontend(t, user?.id));
    },
    staleTime: 60 * 1000,
  });

  // Real-time WebSocket Listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewTweet = (newTweetRaw: any) => {
      const newTweet = mapBackendTweetToFrontend(newTweetRaw, user?.id);
      
      // Inject directly into React Query Cache
      queryClient.setQueryData(['tweets'], (oldData: TweetType[] | undefined) => {
        if (!oldData) return [newTweet];
        // Check for duplicates
        if (oldData.some(t => t.id === newTweet.id)) return oldData;
        
        return [newTweet, ...oldData];
      });

      // Browser Notification Logic (Only if it's someone else's tweet)
      if (areNotificationsActive() && containsKeywords(newTweet.content) && newTweet.user.username !== user?.username) {
        sendTweetNotification({
          content: newTweet.content,
          user: {
            displayName: newTweet.user.displayName,
            username: newTweet.user.username,
            avatar: newTweet.user.avatar,
          },
        });
      }
    };

    const handleTweetUpdated = (updatedTweetRaw: any) => {
      const updatedTweet = mapBackendTweetToFrontend(updatedTweetRaw, user?.id);
      queryClient.setQueryData(['tweets'], (oldData: TweetType[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(t => t.id === updatedTweet.id ? updatedTweet : t);
      });
    };

    socket.on('new_tweet', handleNewTweet);
    socket.on('tweet_updated', handleTweetUpdated);

    return () => {
      socket.off('new_tweet', handleNewTweet);
      socket.off('tweet_updated', handleTweetUpdated);
    };
  }, [socket, isConnected, queryClient, user?.id, user?.username]);

  // Mutations for Post/Like/Repost
  const postMutation = useMutation({
    mutationFn: async ({ text, image }: { text: string, image?: string }) => {
      const payload = { content: text, image: image || "" };
      const res = await axiosInstance.post("/api/v1/tweets", payload);
      return res.data;
    },
    onError: (error: any) => {
      console.error("Failed to post tweet to Express backend:", error);
      if (error.response?.status === 403 && error.response?.data?.error === "LIMIT_EXCEEDED") {
        setShowSubscriptionModal(true);
      }
    }
  });

  const toggleInteraction = useMutation({
    mutationFn: async ({ id, type }: { id: string, type: 'like' | 'repost' | 'bookmark' }) => {
      await axiosInstance.post(`/api/v1/tweets/${id}/${type}`);
    },
    onMutate: async ({ id, type }) => {
      // Optimistic Update
      await queryClient.cancelQueries({ queryKey: ['tweets'] });
      const previousTweets = queryClient.getQueryData(['tweets']);
      
      queryClient.setQueryData(['tweets'], (old: TweetType[] | undefined) => {
        if (!old) return [];
        return old.map(tweet => {
          if (tweet.id === id) {
            if (type === 'like') return { ...tweet, likes: tweet.isLiked ? tweet.likes - 1 : tweet.likes + 1, isLiked: !tweet.isLiked };
            if (type === 'repost') return { ...tweet, reposts: tweet.isReposted ? tweet.reposts - 1 : tweet.reposts + 1, isReposted: !tweet.isReposted };
            if (type === 'bookmark') return { ...tweet, isBookmarked: !tweet.isBookmarked };
          }
          return tweet;
        });
      });
      return { previousTweets };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['tweets'], context?.previousTweets);
    },
  });

  const handleComposerPost = (text: string, image?: string) => {
    if (!user) return;
    postMutation.mutate({ text, image });
  };

  const refetchTweets = () => queryClient.invalidateQueries({ queryKey: ['tweets'] });

  return (
    <div className="bg-black text-white w-full select-none">
      
      {/* Feed Sticky Tabs Header */}
      <header className="sticky top-0 bg-black/85 backdrop-blur-md border-b border-zinc-800 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">{t("home")}</h1>
          <Sparkles className="h-5 w-5 text-zinc-400 hover:text-[#1d9bf0] transition duration-200 cursor-pointer" />
        </div>

        {/* Tab selection lines */}
        <div className="flex border-t border-zinc-900 w-full text-center">
          <button 
            onClick={() => setActiveTab("for-you")} 
            className="flex-1 py-4 font-semibold text-sm hover:bg-zinc-900/50 transition duration-200 relative focus:outline-none focus:ring-2 focus:ring-[#1d9bf0]"
            aria-label="For You timeline"
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
            className="flex-1 py-4 font-semibold text-sm hover:bg-zinc-900/50 transition duration-200 relative focus:outline-none focus:ring-2 focus:ring-[#1d9bf0]"
            aria-label="Following timeline"
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
      <TweetComposer onPost={handleComposerPost} onAudioPostSuccess={refetchTweets} />

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="p-8 text-center text-zinc-500" aria-live="polite">
          Loading tweets...
        </div>
      )}

      {/* Tweets scrollable list */}
      {!isLoading && (
        <div className="divide-y divide-zinc-800" role="feed" aria-busy={isLoading}>
          {tweets.map((tweet: TweetType) => (
            <TweetCard 
              key={tweet.id}
              tweet={tweet}
              onLike={(id) => toggleInteraction.mutate({ id, type: 'like' })}
              onRepost={(id) => toggleInteraction.mutate({ id, type: 'repost' })}
              onBookmark={(id) => toggleInteraction.mutate({ id, type: 'bookmark' })}
            />
          ))}
        </div>
      )}

      {/* Subscription Upgrade Modal */}
      <SubscriptionModal 
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />

    </div>
  );
}
