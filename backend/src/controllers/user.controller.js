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
