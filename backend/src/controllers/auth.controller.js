import crypto from 'crypto';
import User from '../models/User.model.js';
import AppError from '../utils/AppError.js';
import { createSendToken } from '../utils/jwt.js';
import redisClient from '../config/redis.js';
import logger from '../utils/logger.js';

export const register = async (req, res, next) => {
  try {
    const { email, password, username, displayName, avatar } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // If user exists, just log them in (seamless register/login from Firebase)
      return createSendToken(existingUser, 200, res);
    }

    const newUser = await User.create({
      username,
      displayName,
      email,
      password,
      avatar: avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`
    });

    createSendToken(newUser, 201, res);
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password!', 400));
    }

    // 2) Check if user exists && password is correct
    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user || !(await user.correctPassword(password, user.password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    // 3) If everything ok, send token to client
    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

export const preLogin = async (req, res, next) => {
  try {
    const { email, browser, os, device } = req.body;
    if (!email) {
      return next(new AppError('Email is required', 400));
    }

    const cleanEmail = email.trim().toLowerCase();

    // Mobile Time-Lock Check (Strict 10:00 AM – 1:00 PM IST constraint)
    if (device === "mobile") {
      const now = new Date();
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const istNow = new Date(now.getTime() + IST_OFFSET_MS);
      const hours = istNow.getUTCHours();
      const minutes = istNow.getUTCMinutes();
      const totalMinutes = hours * 60 + minutes;
      
      const isWithinMobileISTWindow = totalMinutes >= 600 && totalMinutes < 780;

      if (!isWithinMobileISTWindow) {
        return next(new AppError('Access from mobile devices is strictly restricted to the time window between 10:00 AM and 1:00 PM IST.', 403, 'MOBILE_LOCKED'));
      }
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(200).json({ requiresOtp: false });
    }

    // Google Chrome Environment-Specific Auth Gate
    if (browser === "Google Chrome") {
      const otp = crypto.randomInt(100000, 999999).toString();
      
      // Store in Redis (expires in 5 minutes = 300 seconds)
      await redisClient.setEx(`login_otp:${cleanEmail}`, 300, JSON.stringify({
        otp,
        attempts: 0
      }));

      logger.info(`📧 [DEV] Google Chrome login verification OTP for ${user.email}: ${otp}`);

      return res.status(200).json({
        requiresOtp: true,
        maskedEmail: user.email.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + "*".repeat(gp3.length)),
        devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
        expiresInSeconds: 300
      });
    }

    return res.status(200).json({ requiresOtp: false });
  } catch (err) {
    next(err);
  }
};

export const verifyLoginOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return next(new AppError('Email and otp are required', 400));
    }

    const cleanEmail = email.trim().toLowerCase();
    const redisKey = `login_otp:${cleanEmail}`;
    const storedDataStr = await redisClient.get(redisKey);

    if (!storedDataStr) {
      return next(new AppError('No verification process active or code expired. Please log in again.', 400, 'NO_OTP'));
    }

    const storedData = JSON.parse(storedDataStr);

    if (storedData.attempts >= 3) {
      await redisClient.del(redisKey);
      return next(new AppError('Too many failed attempts. For security, please log in again.', 429, 'LOCKED_OUT'));
    }

    // Secure timing-safe comparison
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(otp.toString().padStart(6, "0")),
      Buffer.from(storedData.otp.padStart(6, "0"))
    );

    if (!isMatch) {
      storedData.attempts += 1;
      const remaining = 3 - storedData.attempts;
      
      if (remaining <= 0) {
        await redisClient.del(redisKey);
        return next(new AppError('Too many failed attempts. For security, please log in again.', 429, 'LOCKED_OUT'));
      }
      
      // Update attempts in Redis, retaining TTL
      const ttl = await redisClient.ttl(redisKey);
      await redisClient.setEx(redisKey, ttl, JSON.stringify(storedData));
      
      return next(new AppError(`Incorrect verification code. ${remaining} attempts remaining.`, 400, 'WRONG_OTP'));
    }

    await redisClient.del(redisKey);
    return res.status(200).json({ status: 'success', message: 'OTP verified successfully.' });
  } catch (err) {
    next(err);
  }
};

export const logSession = async (req, res, next) => {
  try {
    const { email, browser, os, device } = req.body;
    if (!email) return next(new AppError('Email is required', 400));

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) return next(new AppError('User not found', 404));

    let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    if (Array.isArray(ip)) ip = ip[0];
    if (ip === "::1" || ip === "::ffff:127.0.0.1") ip = "127.0.0.1";

    const logEntry = {
      browser: browser || "Other",
      os: os || "Other",
      device: device || "desktop",
      ipAddress: ip,
      loginTime: new Date()
    };

    user.loginHistory.push(logEntry);
    if (user.loginHistory.length > 15) {
      user.loginHistory = user.loginHistory.slice(-15);
    }

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      loginHistory: user.loginHistory
    });
  } catch (err) {
    next(err);
  }
};
