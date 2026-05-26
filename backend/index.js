import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "./modals/user.js";
import Tweet from "./modals/Tweet.js";

dotenv.config();

const app = express();

// Middleware — 150MB limit to handle base64-encoded audio bodies
app.use(cors());
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ limit: "150mb", extended: true }));

// Root verification diagnostic endpoint
app.get("/", (req, res) => {
  res.send("Twiller backend is running successfully");
});

const port = process.env.PORT || 5000;
const url = process.env.MONGO_URI || process.env.MONGODB_URL;

// Mongoose connection setup
mongoose
  .connect(url)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
  });

// ────────────────────────────────────────────────────────────────────────────
// OTP & AUDIO TOKEN STORES (in-memory — survives the process lifetime)
// In production, replace with Redis for multi-instance deployments.
// Key: userId  →  Value: { otp, expiresAt, email, attempts, lastRequested }
// ────────────────────────────────────────────────────────────────────────────
const otpStore = new Map();

// After OTP verified, issue a short-lived audio token for the post request
// Key: token  →  Value: { userId, expiresAt }
const audioTokenStore = new Map();

// ────────────────────────────────────────────────────────────────────────────
// HELPER: Check if current time is within 2:00 PM – 7:00 PM IST
// IST = UTC + 5h 30m
// This function is ALWAYS called server-side and is the authoritative check.
// ────────────────────────────────────────────────────────────────────────────
function isWithinISTWindow() {
  const now = new Date();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5h 30m in milliseconds
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const hours = istNow.getUTCHours();
  const minutes = istNow.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 14:00 = 840 minutes, 19:00 = 1140 minutes
  return totalMinutes >= 840 && totalMinutes < 1140;
}

function getISTTimeString() {
  const now = new Date();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const hours = istNow.getUTCHours().toString().padStart(2, "0");
  const minutes = istNow.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes} IST`;
}

// ────────────────────────────────────────────────────────────────────────────
// HELPER: Mask an email address for display  (karthik@gmail.com → k*****@gmail.com)
// ────────────────────────────────────────────────────────────────────────────
function maskEmail(email) {
  const [local, domain] = email.split("@");
  const masked = local[0] + "*".repeat(Math.max(local.length - 1, 3));
  return `${masked}@${domain}`;
}

// ────────────────────────────────────────────────────────────────────────────
// NODEMAILER TRANSPORTER
// Falls back to console-only mode if EMAIL_USER/EMAIL_PASS not configured.
// ────────────────────────────────────────────────────────────────────────────
let emailTransporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  emailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  console.log("✅ Nodemailer configured with Gmail SMTP");
} else {
  console.warn("⚠️  EMAIL_USER/EMAIL_PASS not set — OTP will be returned in dev response");
}

async function sendOTPEmail(toEmail, otp) {
  if (!emailTransporter) {
    // DEV MODE: Just log + return the OTP
    console.log(`\n📧 [DEV] OTP for ${toEmail}: ${otp}\n`);
    return { devMode: true, otp };
  }

  await emailTransporter.sendMail({
    from: `"Twiller 🐦" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Your Audio Tweet Verification Code",
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background: #000; color: #fff; padding: 32px; border-radius: 16px;">
        <h2 style="color: #1d9bf0; margin: 0 0 16px;">🎙 Audio Tweet OTP</h2>
        <p style="color: #aaa; margin: 0 0 24px;">Use the code below to authenticate your audio tweet upload:</p>
        <div style="background: #111; border: 1px solid #333; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
          <span style="font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #1d9bf0;">${otp}</span>
        </div>
        <p style="color: #666; font-size: 13px; margin: 0;">
          This code expires in <strong style="color: #aaa;">5 minutes</strong>.<br>
          Only valid between <strong style="color: #aaa;">2:00 PM – 7:00 PM IST</strong>.
        </p>
      </div>
    `,
  });
  return { devMode: false };
}

// ════════════════════════════════════════════════════════════════════════════
// AUDIO TWEET ROUTES
// ════════════════════════════════════════════════════════════════════════════

// ── POST /audio/send-otp ──────────────────────────────────────────────────
// Request: { userId }
// Response: { success, maskedEmail, devOtp? }
// Edge cases: outside time window → 403, rate limit → 429, user not found → 404
app.post("/audio/send-otp", async (req, res) => {
  try {
    // 1. Server-side IST time window check (authoritative)
    if (!isWithinISTWindow()) {
      return res.status(403).json({
        error: "TIME_WINDOW",
        message: `Audio tweets can only be posted between 2:00 PM – 7:00 PM IST. Current IST: ${getISTTimeString()}`,
        currentIST: getISTTimeString(),
      });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "MISSING_USER", message: "userId is required" });
    }

    // 2. Look up user's email from MongoDB (email never exposed to frontend)
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "USER_NOT_FOUND", message: "User not found" });
    }
    const email = user.email;

    // 3. Rate limit: max 1 OTP per user per 60 seconds
    const existing = otpStore.get(userId);
    if (existing) {
      const secondsSinceLastRequest = (Date.now() - existing.lastRequested) / 1000;
      if (secondsSinceLastRequest < 60) {
        const waitSeconds = Math.ceil(60 - secondsSinceLastRequest);
        return res.status(429).json({
          error: "RATE_LIMITED",
          message: `Please wait ${waitSeconds}s before requesting another OTP`,
          waitSeconds,
        });
      }
    }

    // 4. Generate 6-digit OTP using cryptographically secure random number
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now

    // 5. Store OTP
    otpStore.set(userId, {
      otp,
      expiresAt,
      email,
      attempts: 0,
      lastRequested: Date.now(),
    });

    // 6. Send email
    const emailResult = await sendOTPEmail(email, otp);

    const responsePayload = {
      success: true,
      maskedEmail: maskEmail(email),
      expiresInSeconds: 300,
    };

    // In dev mode (no SMTP), return OTP in response so developer can test
    if (emailResult.devMode) {
      responsePayload.devOtp = otp;
      responsePayload.devNote = "No EMAIL_USER/EMAIL_PASS set — OTP returned for dev testing";
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error("OTP send error:", err);
    return res.status(500).json({ error: "SERVER_ERROR", message: err.message });
  }
});

// ── POST /audio/verify-otp ───────────────────────────────────────────────
// Request: { userId, otp }
// Response: { success, audioToken }
// Edge cases: expired → 410, wrong OTP → 400, too many attempts → 429
app.post("/audio/verify-otp", (req, res) => {
  try {
    // 1. Server-side time window check
    if (!isWithinISTWindow()) {
      return res.status(403).json({
        error: "TIME_WINDOW",
        message: `Audio tweets can only be posted between 2:00 PM – 7:00 PM IST. Current IST: ${getISTTimeString()}`,
      });
    }

    const { userId, otp } = req.body;
    if (!userId || !otp) {
      return res.status(400).json({ error: "MISSING_FIELDS", message: "userId and otp are required" });
    }

    const stored = otpStore.get(userId);

    // 2. Check if OTP exists for this user
    if (!stored) {
      return res.status(400).json({ error: "NO_OTP", message: "No OTP found. Please request a new one." });
    }

    // 3. Check expiry
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(userId); // clean up
      return res.status(410).json({ error: "OTP_EXPIRED", message: "OTP has expired. Please request a new one." });
    }

    // 4. Check attempt count (max 3)
    if (stored.attempts >= 3) {
      otpStore.delete(userId);
      return res.status(429).json({
        error: "MAX_ATTEMPTS",
        message: "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    // 5. Verify OTP (constant-time comparison to prevent timing attacks)
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(otp.toString().padStart(6, "0")),
      Buffer.from(stored.otp.padStart(6, "0"))
    );

    if (!isMatch) {
      stored.attempts += 1;
      const remaining = 3 - stored.attempts;
      return res.status(400).json({
        error: "WRONG_OTP",
        message: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
        attemptsRemaining: remaining,
      });
    }

    // 6. OTP correct — delete from store (one-time use)
    otpStore.delete(userId);

    // 7. Issue audio token (valid for 30 minutes to allow recording/uploading)
    const audioToken = crypto.randomBytes(32).toString("hex");
    audioTokenStore.set(audioToken, {
      userId,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    });

    return res.status(200).json({ success: true, audioToken });
  } catch (err) {
    console.error("OTP verify error:", err);
    return res.status(500).json({ error: "SERVER_ERROR", message: err.message });
  }
});

// ── POST /audio/post ──────────────────────────────────────────────────────
// Request: { audioToken, userId, content, audioUrl, audioDuration, audioFileName, user }
// Response: the created tweet document
// Edge cases: bad token → 401, expired token → 401, outside window → 403,
//             size exceeded → 413, duration exceeded → 422
app.post("/audio/post", async (req, res) => {
  try {
    // 1. Server-side IST time window check (AUTHORITATIVE — cannot be bypassed client-side)
    if (!isWithinISTWindow()) {
      return res.status(403).json({
        error: "TIME_WINDOW",
        message: `Audio tweets can only be posted between 2:00 PM – 7:00 PM IST. Current IST: ${getISTTimeString()}`,
      });
    }

    const { audioToken, userId, content, audioUrl, audioDuration, audioFileName, user } = req.body;

    // 2. Validate audio token
    if (!audioToken) {
      return res.status(401).json({ error: "NO_TOKEN", message: "Audio verification token required" });
    }

    const tokenData = audioTokenStore.get(audioToken);
    if (!tokenData) {
      return res.status(401).json({ error: "INVALID_TOKEN", message: "Invalid or expired audio token. Please verify OTP again." });
    }

    if (Date.now() > tokenData.expiresAt) {
      audioTokenStore.delete(audioToken);
      return res.status(401).json({ error: "TOKEN_EXPIRED", message: "Session expired. Please verify OTP again." });
    }

    // 3. Ensure token belongs to the requesting user
    if (tokenData.userId !== userId) {
      return res.status(401).json({ error: "TOKEN_MISMATCH", message: "Token does not match user" });
    }

    // 4. Validate audio content
    if (!audioUrl) {
      return res.status(400).json({ error: "NO_AUDIO", message: "Audio data is required" });
    }

    // 5. Server-side size check: base64 string length × 0.75 ≈ byte size
    const approximateSizeBytes = audioUrl.length * 0.75;
    const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
    if (approximateSizeBytes > MAX_SIZE_BYTES) {
      return res.status(413).json({
        error: "FILE_TOO_LARGE",
        message: `Audio file exceeds 100 MB limit. Detected: ${(approximateSizeBytes / (1024 * 1024)).toFixed(1)} MB`,
      });
    }

    // 6. Server-side duration check
    const MAX_DURATION_SECONDS = 5 * 60; // 5 minutes
    if (audioDuration && audioDuration > MAX_DURATION_SECONDS) {
      return res.status(422).json({
        error: "DURATION_EXCEEDED",
        message: `Audio exceeds 5-minute limit. Duration: ${Math.floor(audioDuration / 60)}m ${Math.floor(audioDuration % 60)}s`,
      });
    }

    // 7. Validate user info
    if (!user || !user.displayName || !user.username) {
      return res.status(400).json({ error: "MISSING_USER", message: "User profile information is required" });
    }

    // 8. Require at least a default caption for audio tweets
    const tweetContent = content?.trim() || "🎙 Audio Tweet";

    // 9. Save to MongoDB
    const newTweet = new Tweet({
      content: tweetContent,
      tweetType: "audio",
      audioUrl,
      audioDuration: audioDuration || 0,
      audioFileName: audioFileName || "audio.webm",
      image: "",
      user: {
        displayName: user.displayName,
        username: user.username,
        avatar: user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=anon",
        isVerified: user.isVerified !== undefined ? user.isVerified : true,
      },
      likedBy: [],
      repostedBy: [],
      bookmarkedBy: [],
      replies: 0,
      views: "1",
    });

    await newTweet.save();

    // 10. Invalidate the audio token (one-time use per tweet)
    audioTokenStore.delete(audioToken);

    return res.status(201).json(newTweet);
  } catch (err) {
    console.error("Audio post error:", err);
    return res.status(500).json({ error: "SERVER_ERROR", message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// USER & TWEET ROUTES (unchanged)
// ════════════════════════════════════════════════════════════════════════════

// Register Endpoint
app.post("/register", async (req, res) => {
  try {
    const existinguser = await User.findOne({ email: req.body.email });
    
    // If user already exists, return existing user with 200 OK (seamless registration/login)
    if (existinguser) {
      return res.status(200).send(existinguser);
    }
    
    const newuser = new User({
      username: req.body.username,
      displayName: req.body.displayName,
      email: req.body.email,
      password: req.body.password,
      avatar: req.body.avatar || "",
      bio: req.body.bio || "",
      location: req.body.location || "",
      website: req.body.website || "",
      coverImage: req.body.coverImage || "",
      joinedDate: req.body.joinedDate || "May 2026"
    });

    await newuser.save();
    res.status(201).send(newuser);

  } catch (error) {
    console.error("Registration failure:", error);
    res.status(500).send(error);
  }
});

// Logged In User Endpoint
app.get("/loggedinuser", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({ message: "Email parameter is required" });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (user) {
      res.status(200).send(user);
    } else {
      res.status(200).send(null);
    }
  } catch (error) {
    console.error("Logged in user lookup failure:", error);
    res.status(500).send(error);
  }
});

// Update Profile Endpoint
app.put("/profile", async (req, res) => {
  try {
    const { userId, displayName, bio, location, website, avatar, coverImage } = req.body;
    if (!userId) {
      return res.status(400).send({ message: "User ID is required" });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    
    if (displayName !== undefined) user.displayName = displayName;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    if (avatar !== undefined) user.avatar = avatar;
    if (coverImage !== undefined) user.coverImage = coverImage;
    
    await user.save();
    res.status(200).send(user);

  } catch (error) {
    console.error("Profile update failure:", error);
    res.status(500).send(error);
  }
});

// Create a new tweet
app.post("/post", async (req, res) => {
  try {
    const { content, image, user } = req.body;
    if (!content) {
      return res.status(400).send({ message: "Tweet content is required" });
    }
    if (!user || !user.displayName || !user.username) {
      return res.status(400).send({ message: "User profile information is required" });
    }

    const newTweet = new Tweet({
      content,
      image: image || "",
      user: {
        displayName: user.displayName,
        username: user.username,
        avatar: user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=anon",
        isVerified: user.isVerified !== undefined ? user.isVerified : true
      },
      likedBy: [],
      repostedBy: [],
      bookmarkedBy: [],
      replies: 0,
      views: "1"
    });

    await newTweet.save();
    res.status(201).send(newTweet);
  } catch (error) {
    console.error("Post creation failure:", error);
    res.status(500).send({ error: error.message });
  }
});

// Get all tweets sorted by newest first
app.get("/post", async (req, res) => {
  try {
    const tweets = await Tweet.find().sort({ createdAt: -1 });
    res.status(200).send(tweets);
  } catch (error) {
    console.error("Fetch tweets failure:", error);
    res.status(500).send({ error: error.message });
  }
});

// Toggle Like status on a tweet
app.post("/post/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send({ message: "User ID is required" });
    }

    const tweet = await Tweet.findById(id);
    if (!tweet) {
      return res.status(404).send({ message: "Tweet not found" });
    }

    const index = tweet.likedBy.indexOf(userId);
    if (index === -1) {
      tweet.likedBy.push(userId);
    } else {
      tweet.likedBy.splice(index, 1);
    }

    await tweet.save();
    res.status(200).send(tweet);
  } catch (error) {
    console.error("Like toggle failure:", error);
    res.status(500).send({ error: error.message });
  }
});

// Toggle Repost status on a tweet
app.post("/post/:id/repost", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send({ message: "User ID is required" });
    }

    const tweet = await Tweet.findById(id);
    if (!tweet) {
      return res.status(404).send({ message: "Tweet not found" });
    }

    const index = tweet.repostedBy.indexOf(userId);
    if (index === -1) {
      tweet.repostedBy.push(userId);
    } else {
      tweet.repostedBy.splice(index, 1);
    }

    await tweet.save();
    res.status(200).send(tweet);
  } catch (error) {
    console.error("Repost toggle failure:", error);
    res.status(500).send({ error: error.message });
  }
});

// Toggle Bookmark status on a tweet
app.post("/post/:id/bookmark", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send({ message: "User ID is required" });
    }

    const tweet = await Tweet.findById(id);
    if (!tweet) {
      return res.status(404).send({ message: "Tweet not found" });
    }

    const index = tweet.bookmarkedBy.indexOf(userId);
    if (index === -1) {
      tweet.bookmarkedBy.push(userId);
    } else {
      tweet.bookmarkedBy.splice(index, 1);
    }

    await tweet.save();
    res.status(200).send(tweet);
  } catch (error) {
    console.error("Bookmark toggle failure:", error);
    res.status(500).send({ error: error.message });
  }
});

// Alias PUT endpoints
app.put("/like/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).send({ message: "User ID is required" });

    const tweet = await Tweet.findById(id);
    if (!tweet) return res.status(404).send({ message: "Tweet not found" });

    const index = tweet.likedBy.indexOf(userId);
    if (index === -1) tweet.likedBy.push(userId);
    else tweet.likedBy.splice(index, 1);

    await tweet.save();
    res.status(200).send(tweet);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.put("/retweet/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).send({ message: "User ID is required" });

    const tweet = await Tweet.findById(id);
    if (!tweet) return res.status(404).send({ message: "Tweet not found" });

    const index = tweet.repostedBy.indexOf(userId);
    if (index === -1) tweet.repostedBy.push(userId);
    else tweet.repostedBy.splice(index, 1);

    await tweet.save();
    res.status(200).send(tweet);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});
