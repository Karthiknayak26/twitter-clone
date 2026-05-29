import { body, validationResult } from 'express-validator';
import AppError from '../utils/AppError.js';

/**
 * Common middleware to catch express-validator errors and pass them to global error handler.
 */
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMsg = errors.array().map(err => `${err.path}: ${err.msg}`).join(', ');
    return next(new AppError(`Validation failed: ${errorMsg}`, 400));
  }
  next();
};

/**
 * Validation rules for user registration
 */
export const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .trim(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('username')
    .notEmpty()
    .withMessage('Username is required')
    .trim()
    .isAlphanumeric()
    .withMessage('Username must contain only alphanumeric characters'),
  body('displayName')
    .notEmpty()
    .withMessage('Display name is required')
    .trim()
    .isLength({ max: 50 })
    .withMessage('Display name cannot exceed 50 characters'),
  validateRequest
];

/**
 * Validation rules for user login
 */
export const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .trim(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validateRequest
];

/**
 * Validation rules for pre-login check
 */
export const validatePreLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .trim(),
  validateRequest
];

/**
 * Validation rules for verifying login OTP
 */
export const validateVerifyLoginOtp = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .trim(),
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits')
    .isNumeric()
    .withMessage('OTP must be a numeric value'),
  validateRequest
];

/**
 * Validation rules for requesting password reset
 */
export const validateForgotPassword = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .trim(),
  validateRequest
];

/**
 * Validation rules for verifying language change OTP
 */
export const validateLanguageOtp = [
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits')
    .isNumeric()
    .withMessage('OTP must be a numeric value'),
  validateRequest
];

/**
 * Validation rules for verifying audio tweet OTP
 */
export const validateAudioOtp = [
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits')
    .isNumeric()
    .withMessage('OTP must be a numeric value'),
  validateRequest
];
