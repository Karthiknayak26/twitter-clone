import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import app from './src/app.js';
import logger from './src/utils/logger.js';

// Uncaught Exception Handler
process.on('uncaughtException', err => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(err.name, err.message, err.stack);
  process.exit(1);
});

dotenv.config();

const port = process.env.PORT || 5000;
const url = process.env.MONGO_URI || process.env.MONGODB_URL;

// Create HTTP Server
const server = http.createServer(app);

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

// Setup socket connections
import socketHandler from './src/sockets/index.js';
socketHandler(io);

// Connect to MongoDB
mongoose
  .connect(url)
  .then(() => {
    logger.info('✅ Connected to MongoDB successfully.');
    server.listen(port, () => {
      logger.info(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
    });
  })
  .catch((err) => {
    logger.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Unhandled Rejection Handler
process.on('unhandledRejection', err => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

export { io };
