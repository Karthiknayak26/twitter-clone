import express from 'express';
import { 
  register, 
  login, 
  preLogin, 
  verifyLoginOtp, 
  logSession 
} from '../controllers/auth.controller.js';
import {
  validateRegister,
  validateLogin,
  validatePreLogin,
  validateVerifyLoginOtp
} from '../middleware/validation.middleware.js';

const router = express.Router();

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/pre-login', validatePreLogin, preLogin);
router.post('/verify-login-otp', validateVerifyLoginOtp, verifyLoginOtp);
router.post('/log-session', logSession);

export default router;
