import Tweet from '../models/Tweet.model.js';
import User from '../models/User.model.js';
import AppError from '../utils/AppError.js';
import crypto from 'crypto';
import redisClient from '../config/redis.js';
import { io } from '../../server.js';
import logger from '../utils/logger.js';

// Helper for Audio Time Window Checking
const isWithinISTWindow = () => {
  const now = new Date();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const hours = istNow.getUTCHours();
  const minutes = istNow.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 14:00 = 840 minutes, 19:00 = 1140 minutes
  return totalMinutes >= 840 && totalMinutes < 1140;
};

// Check if user exceeded subscription plan limits
const checkSubscriptionLimit = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  const plan = user.subscriptionPlan || "Free";
  const planLimits = { Free: 1, Bronze: 3, Silver: 5, Gold: Infinity };
  const limit = planLimits[plan] || 1;
  
  const currentTweetsCount = await Tweet.countDocuments({ "user._id": userId });
  if (currentTweetsCount >= limit) {
    throw new AppError(`You have reached the posting limit for your ${plan} Plan (${limit} tweet${limit > 1 ? "s" : ""}). Please upgrade your plan to continue posting.`, 403, 'LIMIT_EXCEEDED');
  }
};

export const createTweet = async (req, res, next) => {
  try {
    const { content, image } = req.body;
    
    if (!content) return next(new AppError('Tweet content is required', 400));

    // Subscription Limit Guard
    await checkSubscriptionLimit(req.user.id);

    const newTweet = await Tweet.create({
      content,
      image: image || "",
      user: {
        _id: req.user._id,
        displayName: req.user.displayName,
        username: req.user.username,
        avatar: req.user.avatar,
      }
    });

    // Real-time broadcast
    io.emit('new_tweet', newTweet);

    res.status(201).json({ status: 'success', data: { tweet: newTweet } });
  } catch (err) {
    next(err);
  }
};

export const getAllTweets = async (req, res, next) => {
  try {
    // Implement cursor-based pagination for scalability
    const limit = parseInt(req.query.limit) || 20;
    const cursor = req.query.cursor; // Last tweet ID seen
    
    const query = cursor ? { _id: { $lt: cursor } } : {};
    
    const tweets = await Tweet.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(); // Lean for faster read performance

    const hasNextPage = tweets.length === limit;
    const nextCursor = hasNextPage ? tweets[tweets.length - 1]._id : null;

    res.status(200).json({ 
      status: 'success', 
      results: tweets.length,
      data: { tweets },
      pagination: { nextCursor, hasNextPage }
    });
  } catch (err) {
    next(err);
  }
};

// ── AUDIO TWEET OTP LOGIC ──

export const sendAudioOtp = async (req, res, next) => {
  try {
    if (!isWithinISTWindow()) {
      return next(new AppError('Audio tweets can only be posted between 2:00 PM – 7:00 PM IST.', 403, 'TIME_WINDOW'));
    }

    const email = req.user.email;
    const redisKey = `audio_otp:${req.user.id}`;
    
    // Rate limit: max 1 OTP per user per 60 seconds
    const ttl = await redisClient.ttl(redisKey);
    // If TTL > 240 (5 min - 1 min), user requested it less than 60s ago
    if (ttl > 240) {
      return next(new AppError(`Please wait ${ttl - 240}s before requesting another OTP`, 429, 'RATE_LIMITED'));
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    await redisClient.setEx(redisKey, 300, JSON.stringify({ otp, attempts: 0 }));

    logger.info(`📧 [DEV] Audio Tweet OTP for ${email}: ${otp}`);

    res.status(200).json({
      status: 'success',
      maskedEmail: email.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + "*".repeat(gp3.length)),
      devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
      expiresInSeconds: 300
    });
  } catch (err) {
    next(err);
  }
};

export const verifyAudioOtp = async (req, res, next) => {
  try {
    if (!isWithinISTWindow()) {
      return next(new AppError('Audio tweets can only be posted between 2:00 PM – 7:00 PM IST.', 403, 'TIME_WINDOW'));
    }

    const { otp } = req.body;
    if (!otp) return next(new AppError('OTP is required', 400));

    const redisKey = `audio_otp:${req.user.id}`;
    const storedDataStr = await redisClient.get(redisKey);

    if (!storedDataStr) {
      return next(new AppError('No OTP found. Please request a new one.', 400, 'NO_OTP'));
    }

    const storedData = JSON.parse(storedDataStr);

    if (storedData.attempts >= 3) {
      await redisClient.del(redisKey);
      return next(new AppError('Too many incorrect attempts. Please request a new OTP.', 429, 'MAX_ATTEMPTS'));
    }

    const isMatch = crypto.timingSafeEqual(
      Buffer.from(otp.toString().padStart(6, "0")),
      Buffer.from(storedData.otp.padStart(6, "0"))
    );

    if (!isMatch) {
      storedData.attempts += 1;
      const remaining = 3 - storedData.attempts;
      
      if (remaining <= 0) {
        await redisClient.del(redisKey);
        return next(new AppError('Too many incorrect attempts. Please request a new OTP.', 429, 'MAX_ATTEMPTS'));
      }
      
      const ttl = await redisClient.ttl(redisKey);
      await redisClient.setEx(redisKey, ttl, JSON.stringify(storedData));
      
      return next(new AppError(`Incorrect OTP. ${remaining} attempts remaining.`, 400, 'WRONG_OTP'));
    }

    // OTP Correct - Issue short-lived audio token in Redis (30 mins)
    await redisClient.del(redisKey);
    const audioToken = crypto.randomBytes(32).toString("hex");
    await redisClient.setEx(`audio_token:${audioToken}`, 1800, req.user.id);

    res.status(200).json({ status: 'success', audioToken });
  } catch (err) {
    next(err);
  }
};

// ── AUDIO TWEET CREATION ──
// Requires Multer middleware to run first
export const postAudioTweet = async (req, res, next) => {
  try {
    if (!isWithinISTWindow()) {
      return next(new AppError('Audio tweets can only be posted between 2:00 PM – 7:00 PM IST.', 403, 'TIME_WINDOW'));
    }

    const { audioToken, content, audioDuration, audioFileName } = req.body;
    
    // Verify audio token
    if (!audioToken) return next(new AppError('Audio verification token required', 401));
    const tokenUserId = await redisClient.get(`audio_token:${audioToken}`);
    if (!tokenUserId || tokenUserId !== req.user.id) {
      return next(new AppError('Invalid or expired audio token. Please verify OTP again.', 401));
    }

    // Check file from Multer (Cloudinary handles URL generation)
    if (!req.file || !req.file.path) {
      return next(new AppError('Audio file is required', 400));
    }

    // Subscription check
    await checkSubscriptionLimit(req.user.id);

    const newTweet = await Tweet.create({
      content: content?.trim() || "🎙 Audio Tweet",
      tweetType: "audio",
      audioUrl: req.file.path, // Cloudinary URL
      audioDuration: audioDuration || 0,
      audioFileName: audioFileName || req.file.originalname || "audio.webm",
      user: {
        _id: req.user._id,
        displayName: req.user.displayName,
        username: req.user.username,
        avatar: req.user.avatar,
      }
    });

    // Invalidate token
    await redisClient.del(`audio_token:${audioToken}`);

    // Real-time broadcast
    io.emit('new_tweet', newTweet);

    res.status(201).json({ status: 'success', data: { tweet: newTweet } });
  } catch (err) {
    next(err);
  }
};

// ── INTERACTIONS ──

export const toggleInteraction = (field) => async (req, res, next) => {
  try {
    const tweetId = req.params.id;
    const userId = req.user.id;

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) return next(new AppError('Tweet not found', 404));

    const index = tweet[field].indexOf(userId);
    if (index === -1) {
      tweet[field].push(userId);
    } else {
      tweet[field].splice(index, 1);
    }

    await tweet.save();
    
    // Broadcast update
    io.emit('tweet_updated', tweet);

    res.status(200).json({ status: 'success', data: { tweet } });
  } catch (err) {
    next(err);
  }
};
