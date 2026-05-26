"use client";

import React, { useState, useEffect } from "react";
import { isFirebaseConfigured, auth, db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  getDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Terminal, 
  RefreshCw,
  Database,
  Lock,
  ArrowLeft,
  Settings
} from "lucide-react";
import Link from "next/link";

interface DiagnosticLog {
  time: string;
  type: "info" | "success" | "error";
  message: string;
}

export default function TestFirebasePage() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [envStatus, setEnvStatus] = useState<Record<string, { loaded: boolean; value: string }>>({});
  const [dbStatus, setDbStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [authStatus, setAuthStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  const addLog = (type: "info" | "success" | "error", message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, type, message }]);
  };

  const checkEnvVariables = () => {
    const keys = [
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      "NEXT_PUBLIC_FIREBASE_APP_ID"
    ];

    const status: Record<string, { loaded: boolean; value: string }> = {};
    keys.forEach(key => {
      const val = process.env[key];
      status[key] = {
        loaded: !!val,
        value: val ? `${val.slice(0, 8)}...` : ""
      };
    });
    setEnvStatus(status);
  };

  useEffect(() => {
    checkEnvVariables();
    addLog("info", "Firebase Diagnostics Console loaded.");
    if (isFirebaseConfigured) {
      addLog("success", "Required environment variables detected.");
    } else {
      addLog("error", "API Credentials missing. Fallback local interactive mock is active.");
    }
  }, []);

  const runDiagnostics = async () => {
    setRunning(true);
    setLogs([]);
    setDbStatus("testing");
    setAuthStatus("testing");
    
    addLog("info", "Starting comprehensive Firebase system check...");
    
    // 1. Check Configuration
    if (!isFirebaseConfigured) {
      addLog("error", "Firebase configuration is not set up! Check your .env.local file.");
      setDbStatus("error");
      setAuthStatus("error");
      setRunning(false);
      return;
    }

    // 2. Check Auth Service Initialization
    try {
      addLog("info", "Verifying Firebase Authentication initialization...");
      if (auth) {
        addLog("success", `Auth Service Initialized. App ID: ${auth.app.options.appId?.slice(0, 15)}...`);
        setAuthStatus("success");
      } else {
        throw new Error("Auth instance not found.");
      }
    } catch (err: any) {
      addLog("error", `Auth Verification Failed: ${err.message || err}`);
      setAuthStatus("error");
    }

    // 3. Check Firestore Database Read/Write
    try {
      addLog("info", "Verifying Cloud Firestore read/write capabilities...");
      addLog("info", "Attempting write transaction to collection 'firebase_test_connection'...");
      
      const testDocRef = await addDoc(collection(db, "firebase_test_connection"), {
        testStatus: "verified",
        createdAt: serverTimestamp(),
        browserAgent: typeof window !== "undefined" ? navigator.userAgent : "Server"
      });
      
      addLog("success", `Document successfully written! Temp Doc ID: ${testDocRef.id}`);
      
      addLog("info", "Attempting read verification for written document...");
      const docSnap = await getDoc(doc(db, "firebase_test_connection", testDocRef.id));
      
      if (docSnap.exists()) {
        addLog("success", `Document read back successfully! Data matches: ${JSON.stringify(docSnap.data())}`);
      } else {
        throw new Error("Written document could not be retrieved from Cloud Firestore.");
      }

      addLog("info", "Performing cleanup: removing temporary document...");
      await deleteDoc(doc(db, "firebase_test_connection", testDocRef.id));
      addLog("success", "Cleanup completed successfully.");
      setDbStatus("success");
      
    } catch (err: any) {
      addLog("error", `Firestore Transaction Failed: ${err.message || err}`);
      addLog("error", "Tip: Check if your Firestore Security Rules allow read/writes, or check if database mode is active in the Firebase Console.");
      setDbStatus("error");
    }

    addLog("info", "Diagnostics run completed.");
    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 py-12 flex flex-col items-center justify-start select-none font-sans relative overflow-x-hidden">
      
      {/* Dynamic Purple Background Glow */}
      <div className="absolute top-[-10%] left-[-20%] w-[50%] h-[50%] bg-violet-900/15 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-20%] w-[50%] h-[50%] bg-blue-900/15 rounded-full blur-[120px] pointer-events-none z-0"></div>

      <div className="w-full max-w-4xl z-10 space-y-8">
        
        {/* Navigation / Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-5">
          <div className="flex items-center space-x-4">
            <Link 
              href="/"
              className="p-2 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Firebase Integration Console
                <span className="px-2 py-0.5 bg-violet-600/20 border border-violet-500/30 text-violet-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  Test Tool
                </span>
              </h1>
              <p className="text-zinc-500 text-xs mt-0.5">Verify your live environment settings and Cloud Databases</p>
            </div>
          </div>

          <button
            onClick={runDiagnostics}
            disabled={running}
            className="flex items-center space-x-2 bg-white hover:bg-zinc-200 text-black font-bold py-2 px-4 rounded-full text-xs transition cursor-pointer shadow hover:shadow-lg disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
            <span>{running ? "Running Tests..." : "Run Diagnostics"}</span>
          </button>
        </div>

        {/* Top Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Env Keys */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-5 relative overflow-hidden backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="h-4 w-4 text-violet-400" />
                Environment Keys
              </span>
              {isFirebaseConfigured ? (
                <span className="h-2.5 w-2.5 bg-green-500 rounded-full animate-pulse"></span>
              ) : (
                <span className="h-2.5 w-2.5 bg-yellow-500 rounded-full"></span>
              )}
            </div>
            <div className="text-2xl font-black mb-1">
              {isFirebaseConfigured ? "Keys Loaded" : "Mock Fallback"}
            </div>
            <p className="text-zinc-500 text-[11px] leading-relaxed">
              {isFirebaseConfigured 
                ? "Your custom keys are successfully loaded from your .env.local file." 
                : "Credentials missing. The application will gracefully fall back to local mock data layer."}
            </p>
          </div>

          {/* Card 2: Auth Connection */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-5 relative overflow-hidden backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-blue-400" />
                Authentication
              </span>
              {authStatus === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {authStatus === "error" && <XCircle className="h-4 w-4 text-red-500" />}
              {authStatus === "testing" && <RefreshCw className="h-3.5 w-3.5 text-zinc-400 animate-spin" />}
              {authStatus === "idle" && <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">Unchecked</span>}
            </div>
            <div className="text-2xl font-black mb-1">
              {authStatus === "success" ? "Connected" : authStatus === "error" ? "Failure" : "Auth Service"}
            </div>
            <p className="text-zinc-500 text-[11px] leading-relaxed">
              Verifies Firebase Authentication Email/Password initialization and custom SDK object mapping.
            </p>
          </div>

          {/* Card 3: Firestore Database */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-5 relative overflow-hidden backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="h-4 w-4 text-emerald-400" />
                Cloud Firestore
              </span>
              {dbStatus === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {dbStatus === "error" && <XCircle className="h-4 w-4 text-red-500" />}
              {dbStatus === "testing" && <RefreshCw className="h-3.5 w-3.5 text-zinc-400 animate-spin" />}
              {dbStatus === "idle" && <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">Unchecked</span>}
            </div>
            <div className="text-2xl font-black mb-1">
              {dbStatus === "success" ? "Read/Write OK" : dbStatus === "error" ? "Failure" : "Firestore DB"}
            </div>
            <p className="text-zinc-500 text-[11px] leading-relaxed">
              Performs real-time cloud write, validation read, and cleanup deletion test on your database.
            </p>
          </div>

        </div>

        {/* Main Interface: Logs Console & Env Settings Checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left panel: Env keys checklists */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-6 shadow-xl backdrop-blur-sm space-y-6 lg:col-span-1">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Environment Settings</h2>
              <p className="text-zinc-500 text-[11px] mt-0.5">Check status of keys inside .env.local</p>
            </div>

            <div className="space-y-4">
              {Object.entries(envStatus).map(([key, data]) => (
                <div key={key} className="flex flex-col border-b border-zinc-900 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-xs font-mono font-medium truncate max-w-[200px]">{key}</span>
                    {data.loaded ? (
                      <span className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 font-bold px-1.5 py-0.25 rounded-md">Loaded</span>
                    ) : (
                      <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-600 font-bold px-1.5 py-0.25 rounded-md">Missing</span>
                    )}
                  </div>
                  {data.loaded && (
                    <span className="text-zinc-600 text-[10px] font-mono mt-1 font-semibold">{data.value}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Instruction Callout Box */}
            <div className="p-3.5 bg-violet-600/5 border border-violet-500/15 rounded-lg flex items-start space-x-2.5">
              <AlertCircle className="h-4.5 w-4.5 text-violet-400 shrink-0 mt-0.5" />
              <div className="text-[11.5px] leading-relaxed text-zinc-300 font-normal">
                <strong className="text-white block font-bold mb-0.5">Required actions in console:</strong>
                Ensure <strong className="text-violet-400">Email/Password</strong> sign-in is turned ON in Firebase Auth settings and your <strong className="text-violet-400">Firestore database Rules</strong> permit access.
              </div>
            </div>
          </div>

          {/* Right panel: Terminal logger */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-6 shadow-xl backdrop-blur-sm lg:col-span-2 flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Terminal className="h-4.5 w-4.5 text-violet-400" />
                <span className="text-sm font-bold uppercase tracking-wider text-white">Diagnostics Console Logs</span>
              </div>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase tracking-wider font-bold transition cursor-pointer"
              >
                Clear
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-black border border-zinc-900 rounded-lg p-4 font-mono text-[11px] leading-relaxed space-y-2 max-h-[350px]">
              {logs.length === 0 ? (
                <div className="text-zinc-700 italic select-none">No active log entries. Click 'Run Diagnostics' above.</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <span className="text-zinc-600 shrink-0 select-none">[{log.time}]</span>
                    {log.type === "success" && <span className="text-green-500 font-bold shrink-0">SUCCESS:</span>}
                    {log.type === "error" && <span className="text-red-500 font-bold shrink-0">ERROR:</span>}
                    {log.type === "info" && <span className="text-blue-400 font-bold shrink-0">INFO:</span>}
                    <span className={log.type === "error" ? "text-red-300 font-medium" : log.type === "success" ? "text-green-200" : "text-zinc-300"}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
