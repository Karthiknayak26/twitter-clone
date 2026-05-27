import User from '../models/User.model.js';
import AppError from '../utils/AppError.js';
import crypto from 'crypto';
import redisClient from '../config/redis.js';

export const getMe = async (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }
    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    // 1) Create error if user POSTs password data
    if (req.body.password) {
      return next(new AppError('This route is not for password updates. Please use /updateMyPassword.', 400));
    }

    // 2) Filtered out unwanted fields names that are not allowed to be updated
    const filteredBody = {};
    const allowedFields = ['displayName', 'bio', 'location', 'website', 'avatar', 'coverImage', 'phoneNumber'];
    
    Object.keys(req.body).forEach(el => {
      if (allowedFields.includes(el)) filteredBody[el] = req.body[el];
    });

    // 3) Update user document
    const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      status: 'success',
      data: { user: updatedUser }
    });
  } catch (err) {
    next(err);
  }
};

export const requestPasswordReset = async (req, res, next) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return next(new AppError('Email or phone number is required', 400));

    const cleanIdentifier = identifier.trim();

    const user = await User.findOne({
      $or: [
        { email: cleanIdentifier.toLowerCase() },
        { phoneNumber: cleanIdentifier }
      ]
    });

    if (!user) {
      return next(new AppError('No account associated with that email or phone number was found.', 404));
    }

    // Rate-limiting: once per 24 hours
    if (user.lastPasswordResetDate) {
      const oneDayInMs = 24 * 60 * 60 * 1000;
      const msSinceLastReset = Date.now() - new Date(user.lastPasswordResetDate).getTime();
      if (msSinceLastReset < oneDayInMs) {
        return next(new AppError('You can use this option only one time per day.', 429, 'RATE_LIMIT'));
      }
    }

    // Generate random pure alpha password
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let newPassword = "";
    for (let i = 0; i < 12; i++) {
      newPassword += chars[crypto.randomInt(0, chars.length)];
    }

    // user.password will be hashed by the pre('save') hook
    user.password = newPassword;
    user.lastPasswordResetDate = new Date();
    await user.save();

    // In a real app, send email here via nodemailer/sendgrid
    
    res.status(200).json({
      status: 'success',
      message: 'Password reset completed successfully. A temporary password has been generated.',
      maskedEmail: user.email.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + "*".repeat(gp3.length)),
      devPassword: process.env.NODE_ENV === 'development' ? newPassword : undefined
    });
  } catch (err) {
    next(err);
  }
};

// ── LANGUAGE OTP LOGIC ──

export const sendLanguageOtp = async (req, res, next) => {
  try {
    const { targetLanguage } = req.body;
    if (!targetLanguage) {
      return next(new AppError('Target language is required', 400));
    }

    const validLanguages = ["English", "Spanish", "Hindi", "Portuguese", "Chinese", "French"];
    if (!validLanguages.includes(targetLanguage)) {
      return next(new AppError('Invalid target language', 400));
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const redisKey = `lang_otp:${user._id}`;
    
    // Rate limit
    const ttl = await redisClient.ttl(redisKey);
    if (ttl > 270) {
      return next(new AppError(`Please wait ${ttl - 270}s before requesting another OTP`, 429, 'RATE_LIMITED'));
    }

    let destination = "";
    let isEmail = false;

    if (targetLanguage === "French") {
      destination = user.email;
      isEmail = true;
      if (!destination) {
        return next(new AppError('User does not have an email registered', 400, 'MISSING_EMAIL'));
      }
    } else {
      destination = user.phoneNumber;
      isEmail = false;
      if (!destination || destination.trim() === "") {
        return next(new AppError('Please add a phone number to your Profile page before switching to this language.', 400, 'MISSING_PHONE'));
      }
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    
    const otpData = {
      otp,
      targetLanguage,
      emailOrPhone: destination,
      attempts: 0
    };

    await redisClient.setEx(redisKey, 300, JSON.stringify(otpData));

    res.status(200).json({
      success: true,
      message: \`OTP sent successfully to your registered \${isEmail ? "email" : "mobile number"}.\`,
      destination: isEmail ? destination.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + "*".repeat(gp3.length)) : destination.replace(/.(?=.{4})/g, "*"),
      isEmail,
      devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
      expiresInSeconds: 300
    });
  } catch (err) {
    next(err);
  }
};

export const verifyLanguageOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) return next(new AppError('OTP is required', 400));

    const redisKey = \`lang_otp:\${req.user.id}\`;
    const storedDataStr = await redisClient.get(redisKey);

    if (!storedDataStr) {
      return res.status(440).json({ error: "NO_OTP_FOUND", message: "No verification process is active. Please request a new code." });
    }

    const storedData = JSON.parse(storedDataStr);

    if (storedData.attempts >= 3) {
      await redisClient.del(redisKey);
      return res.status(429).json({ error: "LOCKED_OUT", message: "Too many failed attempts. For security, please request a new verification code." });
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
        return res.status(429).json({ error: "LOCKED_OUT", message: "Too many failed attempts. For security, please request a new verification code." });
      }
      
      const ttl = await redisClient.ttl(redisKey);
      await redisClient.setEx(redisKey, ttl, JSON.stringify(storedData));
      
      return res.status(400).json({ error: "WRONG_OTP", message: \`Invalid code. You have \${remaining} attempts remaining.\` });
    }

    // Success!
    await redisClient.del(redisKey);
    const user = await User.findById(req.user.id);
    user.preferredLanguage = storedData.targetLanguage;
    await user.save();

    res.status(200).json({
      success: true,
      preferredLanguage: user.preferredLanguage,
      message: \`Language successfully updated to \${user.preferredLanguage}.\`
    });
  } catch (err) {
    next(err);
  }
};
