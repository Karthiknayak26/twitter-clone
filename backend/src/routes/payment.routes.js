import express from 'express';
import { 
  createCheckoutSession, 
  handleStripeWebhook 
} from '../controllers/payment.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

router.post('/checkout', createCheckoutSession);

export default router;
