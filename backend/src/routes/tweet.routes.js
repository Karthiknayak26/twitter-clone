import express from 'express';
import { 
  createTweet, 
  getAllTweets, 
  sendAudioOtp, 
  verifyAudioOtp, 
  postAudioTweet, 
  toggleInteraction 
} from '../controllers/tweet.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { uploadAudio } from '../config/cloudinary.js';

const router = express.Router();

// Public routes
router.get('/', getAllTweets);

// Protect all routes after this middleware
router.use(protect);

// Standard tweets
router.post('/', createTweet);
router.post('/:id/like', toggleInteraction('likedBy'));
router.post('/:id/repost', toggleInteraction('repostedBy'));
router.post('/:id/bookmark', toggleInteraction('bookmarkedBy'));

// Audio tweets
router.post('/audio/send-otp', sendAudioOtp);
router.post('/audio/verify-otp', verifyAudioOtp);
router.post('/audio/post', uploadAudio.single('audioFile'), postAudioTweet);

export default router;
