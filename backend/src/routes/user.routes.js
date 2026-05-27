import express from 'express';
import { 
  getMe, 
  getUser, 
  updateMe, 
  requestPasswordReset,
  sendLanguageOtp,
  verifyLanguageOtp
} from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/forgot-password/request', requestPasswordReset);

// Protect all routes after this middleware
router.use(protect);

router.get('/me', getMe, getUser);
router.patch('/updateMe', updateMe);
router.get('/:id', getUser);

router.post('/language/send-otp', sendLanguageOtp);
router.post('/language/verify-otp', verifyLanguageOtp);

export default router;
