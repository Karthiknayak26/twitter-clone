"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  X, Mic, Square, Play, Pause, Upload, CheckCircle2, 
  AlertCircle, Lock, RefreshCw, Clock, Music, Volume2 
} from "lucide-react";
import axiosInstance from "@/lib/axiosInstance";
import { 
  isWithinTimeWindow, 
  getTimeWindowStatus, 
  validateAudioFile, 
  getAudioDuration, 
  formatDuration, 
  formatTimeRemaining,
  getISTTimeString
} from "@/lib/audioService";
import { useTranslation } from "@/lib/i18n";

interface AudioTweetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostSuccess: () => void;
}

type Step = "time-check" | "send-otp" | "enter-otp" | "input-audio" | "post-audio";

export default function AudioTweetModal({ isOpen, onClose, onPostSuccess }: AudioTweetModalProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  // Navigation & step states
  const [step, setStep] = useState<Step>("time-check");
  const [isTimeWindowChecked, setIsTimeWindowChecked] = useState(false);
  const [countdownText, setCountdownText] = useState("");
  const [isWindowOpen, setIsWindowOpen] = useState(false);
  
  // OTP States
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpInputs, setOtpInputs] = useState<string[]>(Array(6).fill(""));
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [devOtp, setDevOtp] = useState(""); // Show to user in dev mode if EMAIL_USER not configured
  const [timer, setTimer] = useState(300); // 5 minutes TTL
  const [resendCooldown, setResendCooldown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [audioToken, setAudioToken] = useState("");

  // Input Tab States
  const [inputTab, setInputTab] = useState<"record" | "upload">("record");
  
  // Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [mediaRecorderSupported, setMediaRecorderSupported] = useState(true);
  const [recordingError, setRecordingError] = useState("");
  
  // File / Posting States
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileBase64, setAudioFileBase64] = useState("");
  const [audioDurationSeconds, setAudioDurationSeconds] = useState(0);
  const [caption, setCaption] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState("");
  
  // Audio Player Preview States
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  
  // Refs for media recording & visualization
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // OTP Input Element Refs for Auto-advance
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 1. Time Window Clock & Countdown Effect
  useEffect(() => {
    if (!isOpen) return;

    const checkWindow = () => {
      const status = getTimeWindowStatus();
      setIsWindowOpen(status.isOpen);
      setCountdownText(status.text);
      
      // If we haven't manually moved past time-check, auto-set step
      if (!isTimeWindowChecked) {
        if (status.isOpen) {
          setStep("send-otp");
          setIsTimeWindowChecked(true);
        } else {
          setStep("time-check");
        }
      }
    };

    checkWindow();
    const interval = setInterval(checkWindow, 1000);
    return () => clearInterval(interval);
  }, [isOpen, isTimeWindowChecked]);

  // 2. OTP TTL Expiry & Resend Cooldown Timers
  useEffect(() => {
    if (step !== "enter-otp") return;

    if (timer > 0) {
      const t = setTimeout(() => setTimer(prev => prev - 1), 1000);
      return () => clearTimeout(t);
    } else {
      setOtpError("OTP expired. Please request a new one.");
    }
  }, [step, timer]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  // 3. Recording Duration Timer
  useEffect(() => {
    if (!isRecording) return;

    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration(prev => {
        if (prev >= 300) { // 5 minutes limit
          stopRecording();
          return 300;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  // 4. Waveform Visualization Canvas drawing
  useEffect(() => {
    if (!isRecording || !canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw premium futuristic blue bars
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 1.5;

        // Glowing blue gradient
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, "#1d9bf0");
        gradient.addColorStop(0.5, "#a855f7"); // purple glow
        gradient.addColorStop(1, "#3b82f6");

        ctx.fillStyle = gradient;
        // Center vertically
        const y = (canvas.height - barHeight) / 2;
        ctx.fillRect(x, y, barWidth - 2, barHeight);

        x += barWidth;
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isRecording]);

  // 5. Check if MediaRecorder is supported on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      setMediaRecorderSupported(supported);
    }
  }, []);

  // 6. Preview Player Progress Effect
  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setPreviewCurrentTime(audio.currentTime);
      setPreviewProgress((audio.currentTime / audio.duration) * 100 || 0);
    };

    const handleEnded = () => {
      setIsPlayingPreview(false);
      setPreviewCurrentTime(0);
      setPreviewProgress(0);
    };

    const handleLoadedMetadata = () => {
      setPreviewDuration(audio.duration);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [audioFile]);

  if (!isOpen) return null;

  // Reset Modal state on close or opening
  const handleResetAndClose = () => {
    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }
    // Revoke object URL to prevent memory leaks
    if (previewAudioRef.current) {
      previewAudioRef.current.src = "";
    }
    
    // Clear states
    setStep("time-check");
    setIsTimeWindowChecked(false);
    setOtpInputs(Array(6).fill(""));
    setOtpError("");
    setDevOtp("");
    setTimer(300);
    setAttemptsRemaining(3);
    setAudioToken("");
    setAudioFile(null);
    setAudioFileBase64("");
    setAudioDurationSeconds(0);
    setCaption("");
    setIsPosting(false);
    setPostError(false as any);
    setIsPlayingPreview(false);
    
    onClose();
  };

  // ── OTP Dispatches ────────────────────────────────────────────────────────

  const sendOTP = async () => {
    if (!user) return;
    setIsSendingOtp(true);
    setOtpError("");
    setDevOtp("");
    
    try {
      const response = await axiosInstance.post("/api/v1/tweets/audio/send-otp", { userId: user.id });
      if (response.data.success) {
        setMaskedEmail(response.data.maskedEmail);
        setTimer(response.data.expiresInSeconds || 300);
        setResendCooldown(60); // 60s rate limit
        setStep("enter-otp");
        
        // If server sent devOtp in response, capture it for the user
        if (response.data.devOtp) {
          setDevOtp(response.data.devOtp);
        }
      }
    } catch (err: any) {
      console.error(err);
      setOtpError(err.response?.data?.message || "Failed to send verification email. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOTP = async () => {
    if (!user) return;
    const otp = otpInputs.join("");
    if (otp.length < 6) {
      setOtpError("Please enter the full 6-digit code.");
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError("");

    try {
      const response = await axiosInstance.post("/api/v1/tweets/audio/verify-otp", {
        userId: user.id,
        otp
      });

      if (response.data.success && response.data.audioToken) {
        setAudioToken(response.data.audioToken);
        setStep("input-audio");
      }
    } catch (err: any) {
      console.error(err);
      const remaining = err.response?.data?.attemptsRemaining;
      if (remaining !== undefined) {
        setAttemptsRemaining(remaining);
      }
      setOtpError(err.response?.data?.message || "OTP verification failed.");
      
      // Auto clear input on failure
      setOtpInputs(Array(6).fill(""));
      otpRefs.current[0]?.focus();
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleOtpInputChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    
    const newOtp = [...otpInputs];
    // take only last character typed
    newOtp[index] = value.substring(value.length - 1);
    setOtpInputs(newOtp);

    // Auto-advance to next box if typed
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // If Backspace and empty, go back to previous input box
    if (e.key === "Backspace" && !otpInputs[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ── Recording Control ─────────────────────────────────────────────────────

  const startRecording = async () => {
    if (!mediaRecorderSupported) return;
    
    setRecordingError("");
    setMicPermissionDenied(false);
    audioChunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup Web Audio API analyser for cool futuristic waveform visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // nice small size for crisp thick visualizer bars
      source.connect(analyser);
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([audioBlob], `voice-tweet-${Date.now()}.webm`, { type: "audio/webm" });
        
        // Stop all mic tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Process file
        await handleAudioSource(file);
      };

      recorder.start(100); // chunk every 100ms
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (err: any) {
      console.error("Mic access error:", err);
      setMicPermissionDenied(true);
      setRecordingError("Microphone access denied. Please upload an audio file instead, or grant microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Cleanup Web Audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    }
  };

  // ── Audio File Processing (Upload or Record) ──────────────────────────────

  const handleAudioSource = async (file: File) => {
    setRecordingError("");
    setPostError(false as any);

    // Validate size and length
    const validation = await validateAudioFile(file);
    if (!validation.valid) {
      setRecordingError(validation.error || "Invalid audio file");
      return;
    }

    try {
      const duration = await getAudioDuration(file);
      setAudioDurationSeconds(duration);
      setAudioFile(file);
      
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        setAudioFileBase64(reader.result as string);
        setStep("post-audio");
      };
    } catch (e: any) {
      console.error(e);
      setRecordingError("Failed to parse audio. Please try another audio file.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleAudioSource(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleAudioSource(files[0]);
    }
  };

  // ── Audio Player Preview Control ──────────────────────────────────────────

  const togglePreviewPlay = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    if (isPlayingPreview) {
      audio.pause();
      setIsPlayingPreview(false);
    } else {
      audio.play().catch(err => console.error("Playback failed:", err));
      setIsPlayingPreview(true);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercentage = clickX / width;
    
    audio.currentTime = clickPercentage * audio.duration;
  };

  // ── Post Audio Tweet ──────────────────────────────────────────────────────

  const postAudioTweet = async () => {
    if (!user || !audioFile || !audioFileBase64 || !audioToken) return;

    setIsPosting(true);
    setPostError(false as any);

    try {
      const formData = new FormData();
      formData.append("audioToken", audioToken);
      formData.append("userId", user.id);
      formData.append("content", caption.trim() || "🎙 Audio Tweet");
      formData.append("audioDuration", audioDurationSeconds.toString());
      formData.append("audioFile", audioFile); // The actual File blob

      const res = await axiosInstance.post("/api/v1/tweets/audio/post", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      if (res.data) {
        onPostSuccess();
        handleResetAndClose();
      }
    } catch (err: any) {
      console.error(err);
      setPostError(err.response?.data?.message || "Failed to post audio tweet. Please try again.");
    } finally {
      setIsPosting(false);
    }
  };

  // ── Render Helpers ────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      {/* Modal Dialog */}
      <div className="bg-[#030712] border border-zinc-800 w-full max-w-[520px] rounded-2xl overflow-hidden relative shadow-[0_0_50px_rgba(29,155,240,0.15)] animate-scale-up flex flex-col max-h-[90vh]">
        
        {/* Header bar */}
        <header className="px-5 py-4 border-b border-zinc-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mic className="h-5 w-5 text-[#1d9bf0] animate-pulse" />
            <h3 className="font-bold text-white text-base">{t("audio_tweet")}</h3>
          </div>
          
          <button 
            onClick={handleResetAndClose}
            className="p-1.5 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </header>

        {/* Content body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col text-left">
          
          {/* STEP 0: TIME WINDOW CHECK */}
          {step === "time-check" && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
              <div className="p-4 bg-zinc-900/50 rounded-full border border-zinc-800 text-amber-500 relative">
                <Clock className="h-10 w-10 animate-spin" style={{ animationDuration: '60s' }} />
                <Lock className="h-4.5 w-4.5 text-zinc-900 fill-amber-500 absolute bottom-3 right-3 stroke-[2.5px]" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-white">{t("audio_window_closed") || "Audio Posting Time Window Locked"}</h4>
                <p className="text-sm text-zinc-400 max-w-sm">
                  {t("audio_window_closed") || "Audio tweets are only permitted between 2:00 PM and 7:00 PM IST to maintain controlled feature usage."}
                </p>
              </div>

              {/* Cool countdown badge */}
              <div className="bg-zinc-950 border border-zinc-800 px-5 py-3 rounded-xl flex flex-col items-center">
                <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">{t("expires_in") || "Time Remaining"}</span>
                <span className="text-white font-mono text-2xl font-bold mt-1 tracking-tight">
                  {countdownText}
                </span>
                <span className="text-zinc-600 text-[11px] mt-1">Current IST: {getISTTimeString()}</span>
              </div>
            </div>
          )}

          {/* STEP 1: EMAIL VERIFICATION */}
          {step === "send-otp" && (
            <div className="space-y-6 py-2">
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-white">{t("audio_otp_req") || "Secure OTP Verification"}</h4>
                <p className="text-sm text-zinc-400">
                  {t("audio_otp_sent") || "Before sharing audio contents, please verify your identity via a 6-digit OTP sent to your registered email address."}
                </p>
              </div>

              <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-xs">{t("registered_email") || "Registered Email"}</span>
                  <span className="text-white font-medium text-sm mt-0.5 select-all">
                    {user?.email ? user.email : "Loading email profile..."}
                  </span>
                </div>
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400">
                  <Lock className="h-4.5 w-4.5" />
                </div>
              </div>

              {otpError && (
                <div className="p-3 bg-red-950/30 border border-red-900/50 text-red-400 rounded-lg flex items-start space-x-2 text-sm leading-relaxed">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{otpError}</span>
                </div>
              )}

              <button
                onClick={sendOTP}
                disabled={isSendingOtp}
                className="w-full bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold py-2.5 rounded-full text-sm transition duration-200 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSendingOtp ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>{t("verifying") || "Sending OTP..."}</span>
                  </>
                ) : (
                  <span>{t("resend_code") || "Send Verification Code"}</span>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: ENTER OTP */}
          {step === "enter-otp" && (
            <div className="space-y-6 py-2">
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-white">{t("verification_code") || "Enter Security Code"}</h4>
                <p className="text-sm text-zinc-400">
                  {t("otp_sent_to") || "We've sent a 6-digit OTP code to"} <strong className="text-zinc-200">{maskedEmail || "your email"}</strong>.
                </p>
              </div>

              {/* Dev mode assist banner */}
              {devOtp && (
                <div className="p-3 bg-[#1d9bf0]/10 border border-[#1d9bf0]/30 rounded-xl flex flex-col space-y-1">
                  <span className="text-[#1d9bf0] text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 fill-[#1d9bf0] text-[#030712]" /> {t("dev_panel") || "Dev Mode Helper"}
                  </span>
                  <p className="text-zinc-400 text-xs leading-normal">
                    {t("dev_otp_desc") || "SMTP not configured in server environment. Enter this developer code below:"}
                  </p>
                  <span className="font-mono text-[#1d9bf0] text-lg font-bold select-all tracking-wider pt-1">{devOtp}</span>
                </div>
              )}

              {/* 6 Digit input layout */}
              <div className="flex justify-between gap-1.5 sm:gap-2.5 max-w-sm mx-auto py-2">
                {otpInputs.map((val, idx) => (
                  <input
                    key={idx}
                    type="text"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    ref={(el) => { otpRefs.current[idx] = el; }}
                    value={val}
                    onChange={(e) => handleOtpInputChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-9 h-11 sm:w-11 sm:h-12 bg-black border border-zinc-800 rounded-lg text-center font-bold text-base sm:text-lg text-[#1d9bf0] outline-none transition focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0]"
                  />
                ))}
              </div>

              <div className="flex justify-between items-center text-xs px-1">
                <span className="text-zinc-500 flex items-center gap-1 font-mono">
                  <Clock className="h-3.5 w-3.5" />
                  {t("expires_in") || "Code expires in"}: <span className={timer < 60 ? "text-red-500 font-bold" : "text-zinc-300 font-medium"}>
                    {formatDuration(timer)}
                  </span>
                </span>
                <span className="text-zinc-500">
                  {t("attempts_remaining") || "Attempts remaining"}: <strong className="text-zinc-300 font-bold">{attemptsRemaining}</strong>
                </span>
              </div>

              {otpError && (
                <div className="p-3 bg-red-950/30 border border-red-900/50 text-red-400 rounded-lg flex items-start space-x-2 text-sm leading-relaxed">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{otpError}</span>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  onClick={verifyOTP}
                  disabled={isVerifyingOtp || timer === 0 || otpInputs.some(v => !v)}
                  className="w-full bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold py-2.5 rounded-full text-sm transition duration-200 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isVerifyingOtp ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{t("verifying") || "Verifying Code..."}</span>
                    </>
                  ) : (
                    <span>{t("verify_code") || "Verify and Authenticate"}</span>
                  )}
                </button>

                <button
                  onClick={sendOTP}
                  disabled={resendCooldown > 0 || isSendingOtp}
                  className="w-full bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 font-bold py-2 rounded-full text-sm transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                >
                  {resendCooldown > 0 ? (
                    <span>{t("resend_code") || "Resend Code"} ({resendCooldown}s)</span>
                  ) : (
                    <span>{t("resend_code") || "Resend Code"}</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: AUDIO INPUT (RECORD / UPLOAD) */}
          {step === "input-audio" && (
            <div className="space-y-5 flex-1 flex flex-col min-h-0">
              
              {/* Tab Selector */}
              <div className="flex border-b border-zinc-900">
                <button
                  onClick={() => setInputTab("record")}
                  className={`flex-1 pb-3 text-sm font-bold border-b-2 text-center transition cursor-pointer ${inputTab === "record" ? "border-[#1d9bf0] text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
                >
                  {t("record_tab") || "🎙 Record Live Voice"}
                </button>
                <button
                  onClick={() => setInputTab("upload")}
                  className={`flex-1 pb-3 text-sm font-bold border-b-2 text-center transition cursor-pointer ${inputTab === "upload" ? "border-[#1d9bf0] text-[#1d9bf0]" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
                >
                  {t("upload_tab") || "📁 Upload Audio File"}
                </button>
              </div>

              {/* Limits Warning badge */}
              <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl flex justify-between items-center text-xs">
                <span className="text-zinc-500">{t("audio_guidelines") || "Audio Guidelines"}:</span>
                <div className="flex space-x-3 text-zinc-300">
                  <span className="flex items-center gap-1 font-semibold"><Clock className="h-3.5 w-3.5 text-[#1d9bf0]" /> Max 5 Mins</span>
                  <span className="flex items-center gap-1 font-semibold"><Music className="h-3.5 w-3.5 text-[#1d9bf0]" /> Max 100 MB</span>
                </div>
              </div>

              {/* Errors */}
              {recordingError && (
                <div className="p-3 bg-red-950/30 border border-red-900/50 text-red-400 rounded-lg flex items-start space-x-2 text-sm leading-relaxed">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{recordingError}</span>
                </div>
              )}

              {/* Tab 1: RECORD AUDIO */}
              {inputTab === "record" && (
                <div className="flex-1 flex flex-col items-center justify-center py-6 space-y-6">
                  {isRecording ? (
                    <div className="w-full flex flex-col items-center space-y-4">
                      {/* Live Waveform Canvas */}
                      <canvas 
                        ref={canvasRef} 
                        width={360} 
                        height={80} 
                        className="w-full max-w-[360px] h-20 bg-black rounded-lg border border-zinc-900"
                      />
                      
                      <div className="flex flex-col items-center">
                        {/* Red pulsating circle */}
                        <div className="flex items-center space-x-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping"></span>
                          <span className="text-xs text-red-400 font-bold uppercase tracking-wider">{t("recording_voice") || "Recording voice..."}</span>
                        </div>
                        <span className="text-white font-mono text-3xl font-bold mt-1.5 tracking-tight">
                          {formatDuration(recordingDuration)}
                        </span>
                      </div>

                      <button
                        onClick={stopRecording}
                        className="h-16 w-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] cursor-pointer"
                      >
                        <Square className="h-6 w-6 fill-current" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center py-4 space-y-6 text-center">
                      <div className="h-20 w-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#1d9bf0]">
                        <Mic className="h-10 w-10" />
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-white font-semibold">{t("record_press") || "Tap to Record Audio"}</p>
                        <p className="text-zinc-500 text-xs max-w-xs">
                          {t("mic_access_desc") || "Grant microphone access. Your stream is authenticated and secure."}
                        </p>
                      </div>

                      <button
                        onClick={startRecording}
                        disabled={micPermissionDenied || !mediaRecorderSupported}
                        className="bg-[#1d9bf0] hover:bg-[#1a8cd8] disabled:bg-zinc-800 disabled:pointer-events-none text-white font-bold px-6 py-3 rounded-full text-sm transition-all flex items-center gap-2 cursor-pointer shadow-[0_4px_15px_rgba(29,155,240,0.2)]"
                      >
                        <Mic className="h-4 w-4" /> {t("record_tab") || "Start Voice Recording"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: UPLOAD FILE */}
              {inputTab === "upload" && (
                <div className="flex-1 flex flex-col">
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="flex-1 border-2 border-dashed border-zinc-800 hover:border-[#1d9bf0]/50 rounded-2xl flex flex-col items-center justify-center p-8 text-center bg-zinc-950/20 hover:bg-zinc-950/50 transition duration-150 cursor-pointer relative"
                  >
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    
                    <div className="h-14 w-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#1d9bf0] mb-4">
                      <Upload className="h-7 w-7" />
                    </div>

                    <div className="space-y-1">
                      <p className="text-white font-semibold text-sm">{t("upload_press") || "Drag & Drop audio file here"}</p>
                      <p className="text-zinc-500 text-xs">{t("or_click_browse") || "or click to browse local files"}</p>
                    </div>

                    <p className="text-zinc-600 text-[10.5px] mt-6">
                      Supports MP3, WAV, M4A, WEBM, FLAC and all web audio containers.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: PREVIEW AND CAPTION */}
          {step === "post-audio" && audioFile && (
            <div className="space-y-5 flex-1 flex flex-col min-h-0">
              
              {/* Optional Caption Editor */}
              <div className="space-y-1.5 text-left">
                <label className="text-zinc-400 text-xs font-semibold ml-0.5">{t("caption_label") || "Tweet Caption (Optional)"}</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 280))}
                  placeholder={t("caption_placeholder") || "Describe your audio tweet..."}
                  rows={3}
                  className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-sm outline-none resize-none transition focus:border-[#1d9bf0]"
                />
                <div className="flex justify-end text-[11px] text-zinc-500 px-0.5">
                  {caption.length} / 280
                </div>
              </div>

              {/* Premium Audio Preview Box */}
              <div className="p-4 bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-2xl flex flex-col space-y-4">
                
                {/* Audio Info */}
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-[#1d9bf0]/10 border border-[#1d9bf0]/20 flex items-center justify-center text-[#1d9bf0]">
                    <Music className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col text-left overflow-hidden">
                    <span className="text-white text-sm font-bold truncate leading-tight select-none">
                      {audioFile.name || "Voice Audio Tweet"}
                    </span>
                    <span className="text-zinc-500 text-xs mt-0.5">
                      {(audioFile.size / (1024 * 1024)).toFixed(2)} MB · {formatDuration(audioDurationSeconds)}
                    </span>
                  </div>
                </div>

                {/* Custom Audio Element */}
                <audio 
                  ref={previewAudioRef} 
                  src={audioFileBase64} 
                  preload="metadata"
                />

                {/* Progress bar interface */}
                <div className="flex items-center space-x-3 select-none">
                  
                  {/* Play/Pause icon */}
                  <button
                    onClick={togglePreviewPlay}
                    className="h-10 w-10 bg-[#1d9bf0] hover:bg-[#1a8cd8] rounded-full flex items-center justify-center text-white transition cursor-pointer shadow-[0_2px_8px_rgba(29,155,240,0.3)] shrink-0"
                  >
                    {isPlayingPreview ? (
                      <Pause className="h-4.5 w-4.5 fill-current" />
                    ) : (
                      <Play className="h-4.5 w-4.5 fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Slider Progress Bar */}
                  <div className="flex-1 flex flex-col space-y-1">
                    <div 
                      onClick={handleProgressClick}
                      className="h-1.5 w-full bg-zinc-800 hover:h-2 rounded-full cursor-pointer overflow-hidden transition-all duration-100 relative"
                    >
                      <div 
                        className="h-full bg-gradient-to-r from-[#1d9bf0] to-purple-500 rounded-full"
                        style={{ width: `${previewProgress}%` }}
                      />
                    </div>

                    {/* Timestamps */}
                    <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                      <span>{formatDuration(previewCurrentTime)}</span>
                      <span>{formatDuration(previewDuration || audioDurationSeconds)}</span>
                    </div>
                  </div>

                </div>

              </div>

              {/* Post error alert */}
              {postError && (
                <div className="p-3 bg-red-950/30 border border-red-900/50 text-red-400 rounded-lg flex items-start space-x-2 text-sm leading-relaxed">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{postError}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => {
                    // Go back & clear audio preview
                    if (previewAudioRef.current) {
                      previewAudioRef.current.pause();
                    }
                    setIsPlayingPreview(false);
                    setAudioFile(null);
                    setAudioFileBase64("");
                    setStep("input-audio");
                  }}
                  className="flex-1 bg-transparent hover:bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white font-bold py-2.5 rounded-full text-sm transition cursor-pointer"
                >
                  {t("discard") || "Discard Audio"}
                </button>
                <button
                  onClick={postAudioTweet}
                  disabled={isPosting}
                  className="flex-1 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold py-2.5 rounded-full text-sm transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isPosting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{t("posting") || "Posting Tweet..."}</span>
                    </>
                  ) : (
                    <span>{t("posting_audio") || "Post Audio Tweet"}</span>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
