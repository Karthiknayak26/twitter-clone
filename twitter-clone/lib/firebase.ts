import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if credentials are provided and are not placeholders
const hasValidConfig = !!(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "your-firebase-api-key" &&
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY.trim() !== "" &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "your-firebase-project-id" &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.trim() !== ""
);

let app: any = null;
let auth: any = null;
let db: any = null;
let isFirebaseConfigured = false;

if (hasValidConfig) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseConfigured = true;
  } catch (err) {
    if (typeof window !== "undefined") {
      console.error("Firebase SDK failed to initialize with provided credentials:", err);
    }
    isFirebaseConfigured = false;
  }
}

if (!isFirebaseConfigured) {
  if (typeof window !== "undefined") {
    console.warn(
      "Firebase environment variables are missing or invalid! Please populate valid API credentials in your .env.local file to connect the live database. Falling back to local mock data layer."
    );
  }
}

export { app, auth, db, isFirebaseConfigured };
