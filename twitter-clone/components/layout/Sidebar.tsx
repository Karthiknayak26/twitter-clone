"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/lib/i18n";
import { 
  Home as HomeIcon, 
  Search, 
  Bell, 
  Mail, 
  Bookmark, 
  User as UserIcon, 
  LogOut, 
  MoreHorizontal,
  CheckCircle2
} from "lucide-react";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [showLogoutDropdown, setShowLogoutDropdown] = useState(false);

  const navigationItems = [
    { name: "Home", page: "home", icon: HomeIcon, badge: 0 },
    { name: "Explore", page: "explore", icon: Search, badge: 0 },
    { name: "Notifications", page: "notifications", icon: Bell, badge: 3 },
    { name: "Messages", page: "messages", icon: Mail, badge: 0 },
    { name: "Bookmarks", page: "bookmarks", icon: Bookmark, badge: 0 },
    { name: "Profile", page: "profile", icon: UserIcon, badge: 0 },
  ];

  return (
    <aside className="w-16 sm:w-20 xl:w-64 flex flex-col justify-between py-4 border-r border-zinc-800 sticky h-screen top-0 bg-black select-none z-20">
      <div className="flex flex-col items-center xl:items-start space-y-2">
        
        {/* X Logo */}
        <div 
          onClick={() => onNavigate("home")}
          className="h-12 w-12 flex items-center justify-center rounded-full hover:bg-zinc-900 transition duration-200 cursor-pointer xl:ml-2"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-white fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
          </svg>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col space-y-1 w-full mt-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                className="flex items-center justify-center xl:justify-start space-x-5 py-3 px-4 rounded-full hover:bg-zinc-900 transition duration-200 w-fit xl:w-full text-xl group relative"
              >
                <div className="relative">
                  <Icon className={`h-7 w-7 transition-transform group-hover:scale-105 ${isActive ? "text-white stroke-[2.5px]" : "text-zinc-300"}`} />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#1d9bf0] text-white text-[10px] font-bold h-4.5 w-4.5 rounded-full flex items-center justify-center border border-black animate-scale-up">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className={`hidden xl:inline ${isActive ? "font-bold text-white" : "font-normal text-zinc-300"}`}>
                  {item.page === "home" ? t("home") : item.page === "profile" ? t("profile") : item.page === "notifications" ? t("notifications") : item.name}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Large Post Button */}
        <button className="bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold h-12 w-12 xl:h-13 xl:w-full rounded-full mt-4 flex items-center justify-center transition duration-200 shadow-md">
          <span className="hidden xl:inline text-[17px]">{t("post")}</span>
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-white fill-current xl:hidden">
            <path d="M23 3c-6.62-.1-10.38 2.421-13.05 6.03C7.29 12.61 6 17.331 6 22h2c0-1.007.07-2.012.19-3H12c4.1 0 7.48-3.082 7.94-7.054C22.79.018 23 3 23 3zm-6.814 11.054C14.707 14.15 12 14.43 12 15c0 .57 2.707.85 4.186.946C15.17 18.018 12 19 9 19c-1.66 0-3 1.34-3 3H4c0-2.76 2.24-5 5-5 3 0 5.83-.982 7.186-2.946z"></path>
          </svg>
        </button>
      </div>

      {/* User Account Info with Floating Logout Dialog */}
      <div className="relative flex flex-col items-center xl:items-start w-full">
        {showLogoutDropdown && (
          <div className="absolute bottom-16 left-0 xl:left-2 w-48 xl:w-56 bg-black border border-zinc-800 rounded-xl p-2 shadow-2xl z-50 animate-scale-up">
            <button 
              onClick={() => {
                setShowLogoutDropdown(false);
                logout();
              }}
              className="flex items-center space-x-2.5 w-full text-left p-2.5 hover:bg-zinc-900 rounded-lg text-red-500 text-sm font-semibold transition"
            >
              <LogOut className="h-4.5 w-4.5" />
              <span>Log out @{user?.username}</span>
            </button>
          </div>
        )}
        
        <div 
          onClick={() => setShowLogoutDropdown(!showLogoutDropdown)}
          className="flex items-center justify-between w-full p-3 rounded-full hover:bg-zinc-900 transition duration-200 cursor-pointer group"
        >
          <div className="flex items-center space-x-3">
            <img
              src={user?.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=default"}
              alt={user?.displayName}
              className="h-10 w-10 rounded-full border border-zinc-800 bg-zinc-900"
            />
            <div className="hidden xl:flex flex-col text-left text-sm leading-tight">
              <span className="font-bold text-white group-hover:underline flex items-center gap-1">
                {user?.displayName}
                <CheckCircle2 className="h-3.5 w-3.5 fill-[#1d9bf0] text-black stroke-[1.5]" />
              </span>
              <span className="text-zinc-500">@{user?.username}</span>
            </div>
          </div>
          <div className="hidden xl:block text-zinc-400">
            <MoreHorizontal className="h-5 w-5" />
          </div>
        </div>
      </div>
    </aside>
  );
}
