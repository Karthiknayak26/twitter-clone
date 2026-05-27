"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import axiosInstance from "@/lib/axiosInstance";
import LoginVerifyModal from "@/components/ui/LoginVerifyModal";

export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatar: string;
  bio?: string;
  joinedDate: string;
  location?: string;
  website?: string;
  coverImage?: string;
  subscriptionPlan?: string;
  preferredLanguage?: string;
  phoneNumber?: string;
  loginHistory?: any[];
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string, displayName: string) => Promise<void>;
  updateProfile: (profileData: { 
    displayName: string; 
    bio: string; 
    location: string; 
    website: string;
    avatar?: string;
    coverImage?: string;
    phoneNumber?: string;
  }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  googlesignin: () => Promise<void>;
  syncUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginOtpInfo, setLoginOtpInfo] = useState<{
    email: string;
    devOtp?: string;
    resolve: () => void;
    reject: (err: any) => void;
  } | null>(null);

  // Synchronize authentication session state with Express backend
  useEffect(() => {
    if (isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseuser) => {
        if (firebaseuser?.email) {
          try {
            // 1. Fetch user record from Express Backend
            const res = await axiosInstance.get("/api/v1/users/me");

            if (res.data?.data?.user) {
              setUser(res.data.data.user);
              localStorage.setItem("twiller-user", JSON.stringify(res.data.data.user));
            } else {
              // 2. Auto-register user if not in Express database yet (e.g., Google login)
              const newuser = {
                username: firebaseuser.email.split("@")[0].toLowerCase(),
                displayName: firebaseuser.displayName || "User",
                avatar: firebaseuser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${firebaseuser.email.split("@")[0]}`,
                email: firebaseuser.email,
                password: "google-auth-password"
              };

              const regRes = await axiosInstance.post("/api/v1/auth/register", newuser);
              if (regRes.data?.data?.user) {
                setUser(regRes.data.data.user);
                localStorage.setItem("twiller-user", JSON.stringify(regRes.data.data.user));
                if (regRes.data.token) localStorage.setItem("twiller-token", regRes.data.token);
              }
            }
          } catch (err) {
            console.error("Error synchronizing session with Express backend:", err);
          }
        } else {
          setUser(null);
        }
        setIsLoading(false);
      });
      return () => unsubscribe();
    } else {
      // DEGRADED MODE: Local Storage fallback
      const savedUser = localStorage.getItem("twiller-user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // 1. Parse client environment details
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      let browser = "Other";
      let os = "Other";
      let device = "desktop";

      if (ua.includes("Edg") || ua.includes("Edge") || ua.includes("Trident") || ua.includes("MSIE")) {
        browser = "Microsoft Browser";
      } else if ((ua.includes("Chrome") || ua.includes("CriOS")) && !ua.includes("OPR") && !ua.includes("Brd")) {
        browser = "Google Chrome";
      } else if (ua.includes("Firefox") || ua.includes("FxiOS")) {
        browser = "Firefox";
      } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
        browser = "Safari";
      }

      if (ua.includes("Windows")) {
        os = "Windows";
      } else if (ua.includes("Macintosh") || ua.includes("Mac OS X")) {
        os = "macOS";
      } else if (ua.includes("Linux")) {
        os = "Linux";
      } else if (ua.includes("Android")) {
        os = "Android";
      } else if (ua.includes("iPhone") || ua.includes("iPad")) {
        os = "iOS";
      }

      const isMobileUA = /Mobi|Android|iPhone|iPad|Windows Phone/i.test(ua);
      if (isMobileUA || (typeof window !== "undefined" && window.innerWidth < 768)) {
        device = "mobile";
      } else {
        const hasBattery = typeof navigator !== "undefined" && ("getBattery" in navigator);
        const isMacBook = ua.includes("Macintosh");
        const isSmallScreen = typeof window !== "undefined" && window.screen.width <= 1600;

        if (isMacBook || hasBattery || isSmallScreen) {
          device = "laptop";
        } else {
          device = "desktop";
        }
      }

      // 2. Call backend pre-login to enforce daily time gates and browser verification checks
      const preLoginRes = await axiosInstance.post("/api/v1/auth/pre-login", {
        email,
        browser,
        os,
        device
      });

      // 3. Google Chrome Secure OTP authentication gate
      if (preLoginRes.data.requiresOtp) {
        await new Promise<void>((resolve, reject) => {
          setLoginOtpInfo({
            email,
            devOtp: preLoginRes.data.devOtp,
            resolve,
            reject
          });
        });
      }

      // 4. Perform actual authentication with Express API
      const loginRes = await axiosInstance.post("/api/v1/auth/login", { email, password });
      
      if (loginRes.data?.data?.user) {
        setUser(loginRes.data.data.user);
        localStorage.setItem("twiller-user", JSON.stringify(loginRes.data.data.user));
        if (loginRes.data.token) localStorage.setItem("twiller-token", loginRes.data.token);
      }

      // 5. Post-login session logging to store IP, browser, and device in MongoDB
      try {
        await axiosInstance.post("/api/v1/auth/log-session", {
          email,
          browser,
          os,
          device
        });
      } catch (logErr) {
        console.error("Failed to log login session information:", logErr);
      }

    } catch (error: any) {
      console.error("Login failure:", error);
      if (error.response?.data?.error === "MOBILE_LOCKED") {
        throw new Error(error.response.data.message);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, username: string, displayName: string) => {
    setIsLoading(true);
    try {
      const formattedUsername = username.replace("@", "").toLowerCase();
      
      // Write profile details to our custom Express + MongoDB backend
      const newuser = {
        username: formattedUsername,
        displayName: displayName,
        email: email.toLowerCase(),
        password: password,
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${formattedUsername}`
      };
      const regRes = await axiosInstance.post("/api/v1/auth/register", newuser);
      
      if (regRes.data?.data?.user) {
        setUser(regRes.data.data.user);
        localStorage.setItem("twiller-user", JSON.stringify(regRes.data.data.user));
        if (regRes.data.token) localStorage.setItem("twiller-token", regRes.data.token);
      }
    } catch (error) {
      console.error("Signup failure:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      setUser(null);
      localStorage.removeItem("twiller-user");
      localStorage.removeItem("twiller-token");
      if (isFirebaseConfigured) {
        await signOut(auth);
      }
    } catch (error) {
      console.error("Logout failure:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (profileData: { 
    displayName: string; 
    bio: string; 
    location: string; 
    website: string;
    avatar?: string;
    coverImage?: string;
    phoneNumber?: string;
  }) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const updatedFields = {
        userId: user.id,
        displayName: profileData.displayName,
        bio: profileData.bio,
        location: profileData.location,
        website: profileData.website,
        avatar: profileData.avatar !== undefined ? profileData.avatar : user.avatar,
        coverImage: profileData.coverImage !== undefined ? profileData.coverImage : user.coverImage,
        phoneNumber: profileData.phoneNumber !== undefined ? profileData.phoneNumber : (user as any).phoneNumber,
      };

      // Update user profile inside MongoDB Atlas
      const res = await axiosInstance.patch("/api/v1/users/updateMe", updatedFields);
      if (res.data?.data?.user) {
        setUser(res.data.data.user);
        localStorage.setItem("twiller-user", JSON.stringify(res.data.data.user));
      }
    } catch (error) {
      console.error("Profile update failure:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const googlesignin = async () => {
    if (!isFirebaseConfigured) return;
    setIsLoading(true);
    try {
      const googleauthprovider = new GoogleAuthProvider();
      await signInWithPopup(auth, googleauthprovider);
    } catch (error) {
      console.error("Google Sign-In failure:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const syncUser = async () => {
    if (user?.email) {
      try {
        const res = await axiosInstance.get("/api/v1/users/me");
        if (res.data?.data?.user) {
          setUser(res.data.data.user);
          localStorage.setItem("twiller-user", JSON.stringify(res.data.data.user));
        }
      } catch (err) {
        console.error("Failed to sync user session:", err);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, updateProfile, logout, isLoading, googlesignin, syncUser }}>
      {children}
      {loginOtpInfo && (
        <LoginVerifyModal
          isOpen={!!loginOtpInfo}
          email={loginOtpInfo.email}
          devOtp={loginOtpInfo.devOtp}
          onClose={() => {
            loginOtpInfo.reject(new Error("Login verification cancelled by user."));
            setLoginOtpInfo(null);
          }}
          onSuccess={() => {
            loginOtpInfo.resolve();
            setLoginOtpInfo(null);
          }}
        />
      )}
    </AuthContext.Provider>
  );
};
