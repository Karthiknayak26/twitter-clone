import express from 'express';
import { 
  register, 
  login, 
  preLogin, 
  verifyLoginOtp, 
  logSession 
} from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/pre-login', preLogin);
router.post('/verify-login-otp', verifyLoginOtp);
router.post('/log-session', logSession);

export default router;
