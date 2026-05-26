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
  }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  googlesignin: () => Promise<void>;
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

  // Synchronize authentication session state with Express backend
  useEffect(() => {
    if (isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseuser) => {
        if (firebaseuser?.email) {
          try {
            // 1. Fetch user record from Express Backend
            const res = await axiosInstance.get("/loggedinuser", {
              params: { email: firebaseuser.email }
            });

            if (res.data) {
              setUser(res.data);
              localStorage.setItem("twiller-user", JSON.stringify(res.data));
            } else {
              // 2. Auto-register user if not in Express database yet (e.g., Google login)
              const newuser = {
                username: firebaseuser.email.split("@")[0].toLowerCase(),
                displayName: firebaseuser.displayName || "User",
                avatar: firebaseuser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${firebaseuser.email.split("@")[0]}`,
                email: firebaseuser.email,
                password: "google-auth-password"
              };

              const regRes = await axiosInstance.post("/register", newuser);
              if (regRes.data) {
                setUser(regRes.data);
                localStorage.setItem("twiller-user", JSON.stringify(regRes.data));
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
      if (isFirebaseConfigured) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const username = email.split("@")[0].toLowerCase();
        const mockUser: User = {
          id: Date.now().toString(),
          username: username,
          displayName: username.charAt(0).toUpperCase() + username.slice(1),
          avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
          bio: "Software developer passionate about building great products",
          joinedDate: "May 2026",
        };
        setUser(mockUser);
        localStorage.setItem("twiller-user", JSON.stringify(mockUser));
      }
    } catch (error) {
      console.error("Login failure:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, username: string, displayName: string) => {
    setIsLoading(true);
    try {
      const formattedUsername = username.replace("@", "").toLowerCase();
      
      if (isFirebaseConfigured) {
        // Create standard auth record in Firebase Auth
        await createUserWithEmailAndPassword(auth, email, password);
        
        // Write profile details to our custom Express + MongoDB backend
        const newuser = {
          username: formattedUsername,
          displayName: displayName,
          email: email.toLowerCase(),
          password: password,
          avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${formattedUsername}`
        };
        await axiosInstance.post("/register", newuser);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const mockUser: User = {
          id: Date.now().toString(),
          username: formattedUsername,
          displayName: displayName,
          avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${formattedUsername}`,
          bio: "Software developer passionate about building great products",
          joinedDate: "May 2026",
        };
        setUser(mockUser);
        localStorage.setItem("twiller-user", JSON.stringify(mockUser));
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
      if (isFirebaseConfigured) {
        await signOut(auth);
      } else {
        setUser(null);
        localStorage.removeItem("twiller-user");
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
      };

      if (isFirebaseConfigured) {
        // Update user profile inside MongoDB Atlas
        const res = await axiosInstance.put("/profile", updatedFields);
        if (res.data) {
          setUser(res.data);
          localStorage.setItem("twiller-user", JSON.stringify(res.data));
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const updatedUser: User = {
          ...user,
          displayName: profileData.displayName,
          bio: profileData.bio,
          location: profileData.location,
          website: profileData.website,
          avatar: profileData.avatar !== undefined ? profileData.avatar : user.avatar,
          coverImage: profileData.coverImage !== undefined ? profileData.coverImage : user.coverImage,
        };
        setUser(updatedUser);
        localStorage.setItem("twiller-user", JSON.stringify(updatedUser));
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

  return (
    <AuthContext.Provider value={{ user, login, signup, updateProfile, logout, isLoading, googlesignin }}>
      {children}
    </AuthContext.Provider>
  );
};
