import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { globalErrorHandler } from './middleware/error.middleware.js';
import AppError from './utils/AppError.js';

const app = express();

// 1. GLOBAL MIDDLEWARES
// Security HTTP headers
app.use(helmet());

// CORS config (allow frontend domain only in prod)
const allowedOrigins = ['http://localhost:3000'];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
};
app.use(cors(corsOptions));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate Limiting (limit requests from same IP)
const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// Mount Stripe Webhook BEFORE body parser!
import { handleStripeWebhook } from './controllers/payment.controller.js';
app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Body parser, reading data from body into req.body
// Set tight limit for JSON payload to prevent DOS, use multer for files
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Cookie parser
app.use(cookieParser());

// Root verification diagnostic endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Twiller Enterprise API is running optimally.'
  });
});

// 2. ROUTES
import authRouter from './routes/auth.routes.js';
import userRouter from './routes/user.routes.js';
import tweetRouter from './routes/tweet.routes.js';
import paymentRouter from './routes/payment.routes.js';

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/tweets', tweetRouter);
app.use('/api/v1/payments', paymentRouter);

// 3. UNHANDLED ROUTES
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// 4. GLOBAL ERROR HANDLER
app.use(globalErrorHandler);

export default app;
