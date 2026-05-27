import Stripe from 'stripe';
import User from '../models/User.model.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

// Requires STRIPE_SECRET_KEY in .env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16', // Use latest API version
});

// Helper for IST time check
const isWithinPaymentISTWindow = () => {
  const now = new Date();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const hours = istNow.getUTCHours();
  const minutes = istNow.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 10:00 AM = 600 minutes, 11:00 AM = 660 minutes
  return totalMinutes >= 600 && totalMinutes < 660;
};

// Map plans to Stripe Price IDs (requires setup in Stripe Dashboard)
const planPrices = {
  Bronze: process.env.STRIPE_PRICE_BRONZE,
  Silver: process.env.STRIPE_PRICE_SILVER,
  Gold: process.env.STRIPE_PRICE_GOLD
};

export const createCheckoutSession = async (req, res, next) => {
  try {
    if (!isWithinPaymentISTWindow()) {
      return next(new AppError('Premium subscription checkout is only permitted between 10:00 AM and 11:00 AM IST daily.', 403, 'PAYMENT_WINDOW_LOCKED'));
    }

    const { plan } = req.body;
    
    if (!['Bronze', 'Silver', 'Gold'].includes(plan)) {
      return next(new AppError('Invalid subscription plan. Free plan requires no payment.', 400));
    }

    const priceId = planPrices[plan];
    if (!priceId) {
      return next(new AppError('Payment configuration error. Price ID not set on server.', 500));
    }

    // Server-side validation of price/plan - we NEVER trust frontend price!
    // Stripe calculates price based on the priceId.

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      customer_email: req.user.email,
      client_reference_id: req.user.id,
      metadata: {
        userId: req.user.id,
        plan: plan
      }
    });

    res.status(200).json({
      status: 'success',
      sessionUrl: session.url
    });
  } catch (err) {
    next(err);
  }
};

// Stripe Webhook Handler - MUST use express.raw({type: 'application/json'})
export const handleStripeWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // req.body MUST be raw buffer here
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      const userId = session.client_reference_id || session.metadata.userId;
      const plan = session.metadata.plan;

      const user = await User.findById(userId);
      if (user) {
        user.subscriptionPlan = plan;
        user.subscriptionId = session.subscription;
        user.customerId = session.customer;
        await user.save({ validateBeforeSave: false });
        
        logger.info(`✅ User ${user.email} successfully upgraded to ${plan} plan.`);
        
        // In a real app, send Invoice Email here via NodeMailer/SendGrid
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const user = await User.findOne({ subscriptionId: subscription.id });
      if (user) {
        user.subscriptionPlan = 'Free';
        user.subscriptionId = null;
        await user.save({ validateBeforeSave: false });
        logger.info(`🔻 User ${user.email} subscription downgraded to Free.`);
      }
    }

    // Return a 200 res to acknowledge receipt of the event
    res.send();
  } catch (err) {
    logger.error(`Error handling webhook event: ${err.message}`);
    res.status(500).send('Internal Server Error');
  }
};
