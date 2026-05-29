import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import User from '../models/User.model.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

// Requires STRIPE_SECRET_KEY in .env (may be null in dev mode)
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }
} catch (err) {
  logger.warn('Stripe initialization failed — running in dev/simulated mode.');
}

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

// Plan pricing for dev mode invoices
const planPricing = {
  Bronze: 100,
  Silver: 300,
  Gold: 1000
};

// ── Invoice Email Helper ──
const sendInvoiceEmail = async (user, plan, transactionId) => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    logger.warn(`📧 [DEV MODE] Invoice email skipped — EMAIL_USER/EMAIL_PASS not configured.`);
    logger.info(`📧 Invoice for ${user.email}: Plan=${plan}, TxID=${transactionId}, Price=₹${planPricing[plan] || 'N/A'}`);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPass }
    });

    const mailOptions = {
      from: `"Twiller Premium" <${emailUser}>`,
      to: user.email,
      subject: `🎉 Twiller ${plan} Plan — Subscription Invoice`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0a0a0a; color: #fff; border-radius: 16px;">
          <h2 style="color: #8b5cf6; margin-bottom: 4px;">🐦 Twiller Premium</h2>
          <p style="color: #71717a; font-size: 12px; margin-top: 0;">Subscription Invoice</p>
          <hr style="border: 1px solid #27272a;" />
          <table style="width: 100%; font-size: 14px; color: #d4d4d8;">
            <tr><td style="padding: 8px 0; color: #71717a;">Plan</td><td style="text-align: right; font-weight: bold;">${plan}</td></tr>
            <tr><td style="padding: 8px 0; color: #71717a;">Amount</td><td style="text-align: right; color: #34d399; font-weight: bold;">₹${planPricing[plan] || 'N/A'}</td></tr>
            <tr><td style="padding: 8px 0; color: #71717a;">Transaction ID</td><td style="text-align: right; font-family: monospace; font-size: 12px;">${transactionId}</td></tr>
            <tr><td style="padding: 8px 0; color: #71717a;">Date</td><td style="text-align: right;">${new Date().toLocaleDateString()}</td></tr>
            <tr><td style="padding: 8px 0; color: #71717a;">Customer</td><td style="text-align: right;">${user.email}</td></tr>
          </table>
          <hr style="border: 1px solid #27272a;" />
          <p style="color: #71717a; font-size: 11px; text-align: center;">Thank you for subscribing to Twiller Premium!</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info(`📧 Invoice email sent to ${user.email} for ${plan} plan.`);
  } catch (err) {
    logger.error(`📧 Failed to send invoice email: ${err.message}`);
  }
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

    // ── DEV MODE: If Stripe keys are not configured, simulate the payment ──
    const priceId = planPrices[plan];
    if (!stripe || !priceId) {
      logger.warn(`⚠️ Stripe not configured — simulating ${plan} upgrade for user ${req.user.id}`);
      
      const user = await User.findById(req.user.id);
      if (!user) return next(new AppError('User not found', 404));

      const transactionId = `DEV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      user.subscriptionPlan = plan;
      await user.save({ validateBeforeSave: false });

      // Send invoice email (will log to console if SMTP not configured)
      await sendInvoiceEmail(user, plan, transactionId);

      return res.status(200).json({
        status: 'success',
        success: true,
        devInvoice: {
          plan,
          price: planPricing[plan],
          transactionId,
          date: new Date().toLocaleDateString(),
          customerEmail: user.email
        },
        message: `[DEV MODE] Successfully upgraded to ${plan}. Stripe keys not configured.`
      });
    }

    // ── PRODUCTION: Real Stripe Checkout ──
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
  if (!stripe) {
    logger.warn('Stripe webhook received but Stripe is not configured. Ignoring.');
    return res.status(200).send('OK - Stripe not configured');
  }

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
        
        // Send invoice email
        const transactionId = session.id || session.subscription;
        await sendInvoiceEmail(user, plan, transactionId);
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
