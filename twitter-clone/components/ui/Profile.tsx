"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  ArrowLeft, 
  Camera, 
  MapPin, 
  Link as LinkIcon, 
  Calendar,
  CheckCircle2,
  X,
  Bell,
  BellOff,
  BellRing,
  ExternalLink,
  Phone,
  Globe,
  ShieldCheck
} from "lucide-react";
import TweetCard, { TweetType } from "./TweetCard";
import SubscriptionModal from "./SubscriptionModal";
import LanguageVerifyModal from "./LanguageVerifyModal";
import { useTranslation, Language } from "@/lib/i18n";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import axiosInstance from "@/lib/axiosInstance";
import {
  isNotificationSupported,
  getPermissionState,
  requestPermission,
  getUserNotifPref,
  setUserNotifPref,
  TRACKED_KEYWORDS,
} from "@/lib/notificationService";

interface ProfileProps {
  onBack: () => void;
}

export default function Profile({ onBack }: ProfileProps) {
  const { user, updateProfile } = useAuth();
  const { t, currentLanguage } = useTranslation();
  const [activeTab, setActiveTab] = useState<"posts" | "replies" | "highlights" | "articles" | "media">("posts");
  const [profileTweets, setProfileTweets] = useState<TweetType[]>([]);
  
  // Language Switch States
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<Language>("English");

  // Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: "",
    bio: "",
    location: "",
    website: "",
    avatar: "",
    coverImage: "",
    phoneNumber: ""
  });

  // ─── Notification Settings State ─────────────────────────────────────────
  // notifSupported: false if browser doesn't support the Notification API (e.g. Safari iOS)
  // notifPref: user's saved preference (from localStorage)
  // notifPermission: current browser-level permission grant state
  // notifLoading: true while requestPermission() is in-flight
  const [notifSupported, setNotifSupported] = useState<boolean>(true);
  const [notifPref, setNotifPref] = useState<boolean>(false);
  const [notifPermission, setNotifPermission] = useState<"granted" | "denied" | "default" | "unsupported">("default");
  const [notifLoading, setNotifLoading] = useState<boolean>(false);

  // Refs for file inputs
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Sync notification state from localStorage and browser API on mount (client-side only)
  useEffect(() => {
    const supported = isNotificationSupported();
    setNotifSupported(supported);
    if (supported) {
      setNotifPref(getUserNotifPref());
      setNotifPermission(getPermissionState());
    } else {
      setNotifPermission("unsupported");
    }
  }, []);

  /**
   * Handles toggling the notification preference.
   *
   * When enabling:
   *   1. If permission not yet asked → requests it from the browser
   *   2. If granted → saves pref as true
   *   3. If denied → saves pref as false, shows denied state (can't re-prompt)
   *
   * When disabling:
   *   Simply sets pref to false (browsers don't allow revoking permission via JS)
   */
  const handleToggleNotifications = async () => {
    if (!notifSupported) return; // No-op on unsupported browsers

    if (notifPref) {
      // Turning OFF — straightforward
      setUserNotifPref(false);
      setNotifPref(false);
      return;
    }

    // Turning ON — need to check/request browser permission first
    const currentPermission = getPermissionState();

    if (currentPermission === "denied") {
      // Browser has permanently denied — cannot re-request via JS.
      // User must manually update in browser settings.
      setNotifPermission("denied");
      return;
    }

    if (currentPermission === "granted") {
      // Already have permission — just enable the preference
      setUserNotifPref(true);
      setNotifPref(true);
      setNotifPermission("granted");
      return;
    }

    // Permission is "default" — request it now (only valid in response to user gesture)
    setNotifLoading(true);
    try {
      const result = await requestPermission();
      setNotifPermission(result);
      if (result === "granted") {
        setUserNotifPref(true);
        setNotifPref(true);
      } else {
        // User denied the prompt — respect their choice
        setUserNotifPref(false);
        setNotifPref(false);
      }
    } finally {
      setNotifLoading(false);
    }
  };

  // Sync edit form on modal open
  useEffect(() => {
    if (user && showEditModal) {
      setEditForm({
        displayName: user.displayName || "",
        bio: user.bio || "",
        location: user.location || "Earth",
        website: user.website || "example.com",
        avatar: user.avatar || "",
        coverImage: user.coverImage || "",
        phoneNumber: (user as any).phoneNumber || ""
      });
    }
  }, [user, showEditModal]);

  // Image Upload Handlers
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm(prev => ({ ...prev, coverImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Format time helper
  const formatTime = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const fetchProfileTweets = async () => {
    try {
      if (!user) return;
      const res = await axiosInstance.get("/api/v1/tweets");
      if (res.data?.data?.tweets) {
        // Filter to only show user's tweets
        const userTweets = res.data.data.tweets.filter((t: any) => t.user?.username === user.username);
        const mapped = userTweets.map((t: any) => ({
          id: t.id || t._id,
          user: {
            displayName: t.user?.displayName || user.displayName,
            username: t.user?.username || user.username,
            avatar: t.user?.avatar || user.avatar,
            isVerified: t.user?.isVerified !== undefined ? t.user.isVerified : true
          },
          content: t.content || "",
          image: t.image,
          time: t.createdAt ? formatTime(new Date(t.createdAt)) : "Just now",
          likes: (t.likedBy || []).length,
          replies: t.replies || 0,
          reposts: (t.repostedBy || []).length,
          views: t.views || "1",
          isLiked: t.likedBy?.includes(user.id) || false,
          isReposted: t.repostedBy?.includes(user.id) || false,
          isBookmarked: t.bookmarkedBy?.includes(user.id) || false
        }));
        setProfileTweets(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch profile tweets from backend:", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchProfileTweets();
    const interval = setInterval(fetchProfileTweets, 4000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLike = async (id: string) => {
    if (!user) return;

    // Optimistic UI updates
    setProfileTweets(prev => prev.map(tweet => {
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
      await axiosInstance.post(`/api/v1/tweets/${id}/like`, { userId: user.id });
      fetchProfileTweets();
    } catch (error) {
      console.error("Like toggle failure:", error);
    }
  };

  const handleRepost = async (id: string) => {
    if (!user) return;

    // Optimistic UI updates
    setProfileTweets(prev => prev.map(tweet => {
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
      await axiosInstance.post(`/api/v1/tweets/${id}/repost`, { userId: user.id });
      fetchProfileTweets();
    } catch (error) {
      console.error("Repost toggle failure:", error);
    }
  };

  const handleBookmark = async (id: string) => {
    if (!user) return;

    // Optimistic UI updates
    setProfileTweets(prev => prev.map(tweet => {
      if (tweet.id === id) {
        return {
          ...tweet,
          isBookmarked: !tweet.isBookmarked
        };
      }
      return tweet;
    }));

    try {
      await axiosInstance.post(`/api/v1/tweets/${id}/bookmark`, { userId: user.id });
      fetchProfileTweets();
    } catch (error) {
      console.error("Bookmark toggle failure:", error);
    }
  };

  const uploadImageToImgbb = async (base64String: string): Promise<string> => {
    // If it's already a web URL or empty, return it directly
    if (!base64String.startsWith("data:image/")) return base64String;

    const base64Data = base64String.split(",")[1];
    const formData = new FormData();
    formData.append("image", base64Data);

    const response = await fetch("https://api.imgbb.com/1/upload?key=121d9f139512c2779cc88dac7b2115bb", {
      method: "POST",
      body: formData
    });

    const resData = await response.json();
    if (resData.success) {
      return resData.data.url;
    } else {
      throw new Error(resData.error?.message || "Imgbb upload failed");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.displayName.trim()) return;

    setIsSaving(true);
    try {
      let finalAvatar = editForm.avatar;
      let finalCover = editForm.coverImage;

      // 1. Upload Avatar if it is a new base64 image
      if (editForm.avatar && editForm.avatar.startsWith("data:image/")) {
        try {
          finalAvatar = await uploadImageToImgbb(editForm.avatar);
        } catch (err) {
          console.error("Avatar upload failed:", err);
        }
      }

      // 2. Upload Cover Image if it is a new base64 image
      if (editForm.coverImage && editForm.coverImage.startsWith("data:image/")) {
        try {
          finalCover = await uploadImageToImgbb(editForm.coverImage);
        } catch (err) {
          console.error("Cover image upload failed:", err);
        }
      }

      const updatedForm = {
        ...editForm,
        avatar: finalAvatar,
        coverImage: finalCover
      };

      await updateProfile(updatedForm);
      setShowEditModal(false);
    } catch (error) {
      console.error("Failed to update profile", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-white w-full select-none pb-20 relative">
      
      {/* Header Row */}
      <header className="sticky top-0 bg-black/85 backdrop-blur-md border-b border-zinc-800 z-10 px-4 py-2 flex items-center space-x-6">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-zinc-900 rounded-full text-white transition cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight flex flex-wrap items-center gap-1">
            {user.displayName}
            <CheckCircle2 className="h-4.5 w-4.5 fill-[#1d9bf0] text-black stroke-[1.5]" />
            {user.subscriptionPlan === "Bronze" && (
              <span className="text-[10px] bg-amber-700/10 text-amber-500 font-bold px-2 py-0.5 rounded border border-amber-800/20 select-none">🥉 Bronze</span>
            )}
            {user.subscriptionPlan === "Silver" && (
              <span className="text-[10px] bg-zinc-500/10 text-zinc-400 font-bold px-2 py-0.5 rounded border border-zinc-600/20 select-none">🥈 Silver</span>
            )}
            {user.subscriptionPlan === "Gold" && (
              <span className="text-[10px] bg-yellow-500/10 text-yellow-500 font-bold px-2 py-0.5 rounded border border-yellow-600/20 select-none">🥇 Gold</span>
            )}
          </h1>
          <span className="text-[12px] text-zinc-500 font-normal">
            {profileTweets.length} posts
          </span>
        </div>
      </header>

      {/* Cover Photo Area (Vibrant Banner) */}
      <div className="h-48 relative w-full border-b border-zinc-900 select-none bg-zinc-950 flex items-center justify-center overflow-hidden">
        {user.coverImage ? (
          <img 
            src={user.coverImage} 
            alt="Cover Banner" 
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-violet-600 to-purple-600"></div>
        )}
        
        {/* Avatar Profile Image overlapping cover */}
        <div className="absolute -bottom-16 left-4 h-32 w-32 rounded-full border-4 border-black bg-zinc-950 shadow-lg overflow-hidden z-2">
          <img
            src={user.avatar}
            alt={user.displayName}
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      {/* Edit Profile Button Row */}
      <div className="flex justify-end p-4 space-x-2">
        <button 
          onClick={() => setShowSubscriptionModal(true)}
          className="border border-purple-800/50 bg-transparent hover:bg-purple-900/10 text-[#c084fc] font-bold py-1.5 px-4 rounded-full text-[14px] transition cursor-pointer select-none"
        >
          {t("upgrade_plan")}
        </button>
        <button 
          onClick={() => setShowEditModal(true)}
          className="border border-zinc-700 bg-transparent hover:bg-zinc-900 text-white font-bold py-1.5 px-4 rounded-full text-[14px] transition cursor-pointer select-none"
        >
          {t("edit_profile")}
        </button>
      </div>

      {/* ═══════════ NOTIFICATION SETTINGS CARD ═══════════ */}
      <div className="mx-4 mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            {notifPref && notifPermission === "granted" ? (
              <BellRing className="h-5 w-5 text-[#1d9bf0]" />
            ) : (
              <Bell className="h-5 w-5 text-zinc-400" />
            )}
            <div>
              <h3 className="text-white font-bold text-[14px] leading-none">{t("notifications")}</h3>
              <p className="text-zinc-500 text-[11.5px] mt-0.5">
                Get notified for tweets about: {TRACKED_KEYWORDS.map((k) => `#${k}`).join(", ")}
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            id="notification-toggle"
            type="button"
            onClick={handleToggleNotifications}
            disabled={!notifSupported || notifLoading || notifPermission === "denied"}
            aria-label={notifPref ? "Disable tweet notifications" : "Enable tweet notifications"}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${
              !notifSupported || notifPermission === "denied"
                ? "cursor-not-allowed opacity-40 bg-zinc-700"
                : notifPref
                ? "bg-[#1d9bf0] cursor-pointer"
                : "bg-zinc-700 cursor-pointer"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                notifPref ? "translate-x-6" : "translate-x-1"
              } ${notifLoading ? "animate-pulse" : ""}`}
            />
          </button>
        </div>

        {/* Permission Status Row */}
        <div className="px-4 py-3">
          {/* Case 1: Browser not supported */}
          {!notifSupported && (
            <div className="flex items-start gap-2 text-[12px] text-zinc-500">
              <BellOff className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>Browser notifications are not supported in this browser. Try Chrome or Firefox.</span>
            </div>
          )}

          {/* Case 2: Permission denied by browser */}
          {notifSupported && notifPermission === "denied" && (
            <div className="flex items-start gap-2 text-[12px]">
              <span className="text-red-400 font-bold flex-shrink-0 mt-0.5">🔴</span>
              <div>
                <span className="text-red-400 font-semibold">Permission blocked by browser.</span>
                <span className="text-zinc-500 ml-1">
                  To enable, open your browser settings and allow notifications for this site.
                </span>
                <button
                  onClick={() => window.open("chrome://settings/content/notifications", "_blank")}
                  className="flex items-center gap-1 text-[#1d9bf0] hover:underline mt-1 cursor-pointer"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open browser notification settings
                </button>
              </div>
            </div>
          )}

          {/* Case 3: Permission not yet requested */}
          {notifSupported && notifPermission === "default" && (
            <div className="flex items-center gap-2 text-[12px] text-zinc-500">
              <span className="text-yellow-400 font-bold">🟡</span>
              <span>Notification permission not yet granted. Toggle on to request access.</span>
            </div>
          )}

          {/* Case 4: Permission granted, notifications enabled */}
          {notifSupported && notifPermission === "granted" && notifPref && (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-emerald-400 font-bold">🟢</span>
              <span className="text-emerald-400 font-semibold">Active —</span>
              <span className="text-zinc-400">
                you'll be notified for tweets mentioning {TRACKED_KEYWORDS.map((k) => `"${k}"`).join(" or ")}.
              </span>
            </div>
          )}

          {/* Case 5: Permission granted but user disabled preference */}
          {notifSupported && notifPermission === "granted" && !notifPref && (
            <div className="flex items-center gap-2 text-[12px] text-zinc-500">
              <span className="text-zinc-400 font-bold">⚪</span>
              <span>Notifications paused. Toggle on to resume keyword alerts.</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ LANGUAGE PREFERENCES CARD ═══════════ */}
      <div className="mx-4 mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <Globe className="h-5 w-5 text-[#1d9bf0]" />
            <div>
              <h3 className="text-white font-bold text-[14px] leading-none">{t("preferred_language")}</h3>
              <p className="text-zinc-500 text-[11.5px] mt-0.5">
                Current: <span className="text-blue-400 font-semibold">{currentLanguage}</span>
              </p>
            </div>
          </div>

          {/* Selector Dropdown */}
          <div className="relative">
            <select
              value={currentLanguage}
              onChange={(e) => {
                const selectedLang = e.target.value as Language;
                if (selectedLang !== currentLanguage) {
                  setPendingLanguage(selectedLang);
                  setIsLanguageModalOpen(true);
                }
              }}
              className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer transition-all"
            >
              <option value="English">English</option>
              <option value="Spanish">Español (Spanish)</option>
              <option value="Hindi">हिन्दी (Hindi)</option>
              <option value="Portuguese">Português (Portuguese)</option>
              <option value="Chinese">中文 (Chinese)</option>
              <option value="French">Français (French)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ═══════════ LOGIN SESSION HISTORY CARD ═══════════ */}
      <div className="mx-4 mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-zinc-800/60">
          <ShieldCheck className="h-5 w-5 text-[#1d9bf0]" />
          <div>
            <h3 className="text-white font-bold text-[14px] leading-none">Login Session History</h3>
            <p className="text-zinc-500 text-[11.5px] mt-0.5">
              Transparent log of your last login environments.
            </p>
          </div>
        </div>

        {/* Card Body (Scrollable List) */}
        <div className="divide-y divide-zinc-900 max-h-60 overflow-y-auto">
          {user.loginHistory && user.loginHistory.length > 0 ? (
            [...user.loginHistory].reverse().slice(0, 5).map((session: any, idx: number) => (
              <div key={idx} className="px-4 py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center hover:bg-zinc-900/30 transition-all select-none gap-2 sm:gap-0">
                <div className="flex flex-col text-left space-y-0.5">
                  <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                    {session.browser === "Google Chrome" && <span className="text-blue-400 font-bold">🌐 Chrome</span>}
                    {session.browser === "Microsoft Browser" && <span className="text-sky-400 font-bold">🌐 Edge / IE</span>}
                    {session.browser !== "Google Chrome" && session.browser !== "Microsoft Browser" && <span className="text-zinc-300 font-medium">🌐 {session.browser}</span>}
                    <span className="text-[10px] text-zinc-500 font-normal">on {session.os}</span>
                  </span>
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-medium capitalize">
                    {session.device === "mobile" && "📱 Mobile"}
                    {session.device === "laptop" && "💻 Laptop"}
                    {session.device === "desktop" && "🖥 Desktop"}
                    {session.device !== "mobile" && session.device !== "laptop" && session.device !== "desktop" && `🖥 ${session.device}`}
                  </span>
                </div>
                <div className="flex flex-col text-left sm:text-right space-y-0.5">
                  <span className="font-mono text-[10.5px] text-blue-400/90 font-semibold">{session.ipAddress}</span>
                  <span className="text-[9px] text-zinc-500">
                    {new Date(session.loginTime).toLocaleString(undefined, { 
                      month: "short", 
                      day: "numeric", 
                      hour: "2-digit", 
                      minute: "2-digit" 
                    })}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-zinc-500 text-xs font-normal">
              No recent login history sessions recorded.
            </div>
          )}
        </div>
      </div>

      {/* User Metadata / Information section */}
      <div className="px-4 pb-4 space-y-3">
        <div>
          <h2 className="text-xl font-extrabold text-white leading-tight flex flex-wrap items-center gap-1">
            {user.displayName}
            <CheckCircle2 className="h-4.5 w-4.5 fill-[#1d9bf0] text-black stroke-[1.5]" />
            {user.subscriptionPlan === "Bronze" && (
              <span className="text-[10px] bg-amber-700/10 text-amber-500 font-bold px-2 py-0.5 rounded border border-amber-800/20 select-none">🥉 Bronze Plan</span>
            )}
            {user.subscriptionPlan === "Silver" && (
              <span className="text-[10px] bg-zinc-500/10 text-zinc-400 font-bold px-2 py-0.5 rounded border border-zinc-600/20 select-none">🥈 Silver Plan</span>
            )}
            {user.subscriptionPlan === "Gold" && (
              <span className="text-[10px] bg-yellow-500/10 text-yellow-500 font-bold px-2 py-0.5 rounded border border-yellow-600/20 select-none">🥇 Gold Plan</span>
            )}
            {(!user.subscriptionPlan || user.subscriptionPlan === "Free") && (
              <span className="text-[10px] bg-zinc-800/10 text-zinc-500 font-medium px-2 py-0.5 rounded border border-zinc-800/20 select-none">🌱 Free Plan</span>
            )}
          </h2>
          <span className="text-sm text-zinc-500 font-normal">@{user.username}</span>
        </div>

        {/* Bio */}
        <p className="text-[14.5px] text-zinc-150 leading-relaxed font-normal">
          {user.bio || "Software developer passionate about building great products"}
        </p>

        {/* Info Rows with Earth, Link, and Calendar Icons */}
        <div className="flex flex-wrap text-zinc-500 text-sm gap-x-4 gap-y-1.5 font-normal select-none">
          <div className="flex items-center space-x-1">
            <MapPin className="h-4 w-4 text-zinc-500" />
            <span>{user.location || "Earth"}</span>
          </div>
          <div className="flex items-center space-x-1 text-[#1d9bf0] hover:underline cursor-pointer">
            <LinkIcon className="h-4 w-4" />
            <span>{user.website || "example.com"}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4 text-zinc-500" />
            <span>Joined August 2025</span>
          </div>
          {(user as any).phoneNumber && (
            <div className="flex items-center space-x-1">
              <Phone className="h-4 w-4 text-zinc-500" />
              <span>{(user as any).phoneNumber}</span>
            </div>
          )}
        </div>

        {/* Following & Followers counts */}
        <div className="flex space-x-5 text-sm pt-1">
          <span className="text-zinc-500 font-normal">
            <strong className="text-white font-bold">142</strong> Following
          </span>
          <span className="text-zinc-500 font-normal">
            <strong className="text-white font-bold">1.2K</strong> Followers
          </span>
        </div>
      </div>

      {/* Feed Tabs matching: Posts, Replies, Highlights, Articles, Media */}
      <div className="flex border-b border-zinc-800 text-center font-bold text-sm text-zinc-500 select-none">
        {[
          { id: "posts", name: "Posts" },
          { id: "replies", name: "Replies" },
          { id: "highlights", name: "Highlights" },
          { id: "articles", name: "Articles" },
          { id: "media", name: "Media" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex-1 py-3 hover:bg-zinc-900/30 transition cursor-pointer relative"
            >
              <span className={isActive ? "text-white" : "text-zinc-500"}>
                {tab.name}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-4 right-4 h-1 bg-[#1d9bf0] rounded-full"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Dynamic Content Views */}
      <div className="divide-y divide-zinc-800">
        
        {/* Posts Tab */}
        {activeTab === "posts" && (
          profileTweets.map((tweet) => (
            <TweetCard 
              key={tweet.id}
              tweet={tweet}
              onLike={handleLike}
              onRepost={handleRepost}
              onBookmark={handleBookmark}
            />
          ))
        )}

        {/* Replies Tab */}
        {activeTab === "replies" && (
          <div className="py-20 px-4 text-center space-y-2">
            <h3 className="text-xl font-bold text-white tracking-tight">You haven't replied yet</h3>
            <p className="text-zinc-500 text-[13.5px] max-w-sm mx-auto font-normal">
              When you reply to a post, it will show up here.
            </p>
          </div>
        )}

        {/* Highlights Tab */}
        {activeTab === "highlights" && (
          <div className="py-20 px-4 text-center space-y-2">
            <h3 className="text-xl font-bold text-white tracking-tight">Highlight your posts</h3>
            <p className="text-zinc-500 text-[13.5px] max-w-sm mx-auto font-normal">
              You must be subscribed to Premium to highlight posts on your profile.
            </p>
          </div>
        )}

        {/* Articles Tab */}
        {activeTab === "articles" && (
          <div className="py-20 px-4 text-center space-y-2">
            <h3 className="text-xl font-bold text-white tracking-tight">Write articles on X</h3>
            <p className="text-zinc-500 text-[13.5px] max-w-sm mx-auto font-normal">
              Articles compose is currently available for Premium subscribers.
            </p>
          </div>
        )}

        {/* Media Tab */}
        {activeTab === "media" && (
          <div className="py-20 px-4 text-center space-y-2">
            <h3 className="text-xl font-bold text-white tracking-tight">Lights, camera, attachment</h3>
            <p className="text-zinc-500 text-[13.5px] max-w-sm mx-auto font-normal">
              When you post photos or videos, they will show up here.
            </p>
          </div>
        )}

      </div>

      {/* ================= EDIT PROFILE MODAL ================= */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black border border-zinc-800 w-full max-w-[550px] rounded-2xl overflow-hidden relative shadow-2xl animate-scale-up text-left flex flex-col max-h-[90vh]">
            
            {/* Modal Sticky Header */}
            <header className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-black z-10 select-none">
              <div className="flex items-center space-x-5">
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="p-1.5 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-bold text-white leading-none">{t("edit_profile")}</h2>
              </div>
              <button
                type="submit"
                form="edit-profile-form"
                disabled={isSaving || !editForm.displayName.trim()}
                className="bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-bold py-1.5 px-4 rounded-full text-[14px] transition cursor-pointer flex items-center justify-center space-x-1.5 shadow"
              >
                {isSaving ? (
                  <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>{t("save")}</span>
                )}
              </button>
            </header>

            {/* Modal Body (Scrollable container) */}
            <div className="flex-1 overflow-y-auto pb-6">
              
              {/* Modal Cover Image Banner */}
              <div className="h-36 relative w-full border-b border-zinc-900 select-none flex items-center justify-center bg-zinc-950">
                {editForm.coverImage ? (
                  <img 
                    src={editForm.coverImage} 
                    alt="Cover Preview" 
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-violet-600 to-purple-600"></div>
                )}
                
                {/* Upload Trigger Button for Cover Banner */}
                <button 
                  type="button" 
                  onClick={() => coverInputRef.current?.click()}
                  className="relative z-10 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition cursor-pointer flex items-center justify-center"
                >
                  <Camera className="h-5 w-5" />
                </button>
                <input 
                  type="file"
                  ref={coverInputRef}
                  onChange={handleCoverChange}
                  accept="image/*"
                  className="hidden"
                />

                {/* Overlap Circular Avatar inside Modal */}
                <div className="absolute -bottom-12 left-4 h-24 w-24 rounded-full border-3 border-black bg-zinc-950 shadow relative overflow-hidden group">
                  <img
                    src={editForm.avatar || user.avatar}
                    alt={user.displayName}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 hover:bg-black/55 flex items-center justify-center transition cursor-pointer text-white"
                  >
                    <Camera className="h-5 w-5 text-white" />
                  </button>
                  <input 
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Form Input fields */}
              <form id="edit-profile-form" onSubmit={handleSaveProfile} className="px-4 pt-16 space-y-6">
                
                {/* Display Name */}
                <div className="flex flex-col relative">
                  <label className="text-zinc-500 text-[13px] font-semibold mb-1 ml-0.5 select-none">Name</label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white text-sm outline-none focus:border-[#1d9bf0] transition duration-150"
                  />
                  <span className="text-[11px] text-zinc-500 text-right mt-1 font-normal select-none">
                    {editForm.displayName.length}/50
                  </span>
                </div>

                {/* Bio */}
                <div className="flex flex-col relative">
                  <label className="text-zinc-500 text-[13px] font-semibold mb-1 ml-0.5 select-none">Bio</label>
                  <textarea
                    maxLength={160}
                    placeholder="Tell the world about yourself"
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white text-sm outline-none focus:border-[#1d9bf0] transition duration-150 resize-none h-20 placeholder-zinc-700"
                  />
                  <span className="text-[11px] text-zinc-500 text-right mt-1 font-normal select-none">
                    {editForm.bio.length}/160
                  </span>
                </div>

                {/* Location */}
                <div className="flex flex-col relative">
                  <label className="text-zinc-500 text-[13px] font-semibold mb-1 ml-0.5 select-none">Location</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 select-none">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      maxLength={30}
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-white text-sm outline-none focus:border-[#1d9bf0] transition duration-150"
                    />
                  </div>
                  <span className="text-[11px] text-zinc-500 text-right mt-1 font-normal select-none">
                    {editForm.location.length}/30
                  </span>
                </div>

                {/* Website */}
                <div className="flex flex-col relative">
                  <label className="text-zinc-500 text-[13px] font-semibold mb-1 ml-0.5 select-none">Website</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 select-none">
                      <LinkIcon className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      value={editForm.website}
                      onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                      className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-white text-sm outline-none focus:border-[#1d9bf0] transition duration-150"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div className="flex flex-col relative">
                  <label className="text-zinc-500 text-[13px] font-semibold mb-1 ml-0.5 select-none">{t("phone_number")}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 select-none">
                      <Phone className="h-4 w-4" />
                    </span>
                    <input
                      type="tel"
                      value={editForm.phoneNumber}
                      onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                      placeholder="e.g. +1234567890"
                      className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-white text-sm outline-none focus:border-[#1d9bf0] transition duration-150"
                    />
                  </div>
                </div>

              </form>

            </div>

          </div>
        </div>
      )}
      
      {/* Subscription Upgrade Modal */}
      <SubscriptionModal 
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />

      {/* Language Switch Verification Modal */}
      <LanguageVerifyModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        targetLanguage={pendingLanguage}
        onSuccess={(newLang) => {
          console.log(`Language successfully switched to: ${newLang}`);
        }}
      />
      
    </div>
  );
}
