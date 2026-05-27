import logger from '../utils/logger.js';

export default function socketHandler(io) {
  io.on('connection', (socket) => {
    logger.info(`🔌 New client connected: ${socket.id}`);

    // Join a specific room (e.g., user's own channel for private notifications)
    socket.on('join_user_room', (userId) => {
      socket.join(`user_${userId}`);
      logger.info(`Socket ${socket.id} joined room user_${userId}`);
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      // Broadcast to others
      socket.broadcast.emit('user_typing', data);
    });

    // Stop typing indicator
    socket.on('stop_typing', (data) => {
      socket.broadcast.emit('user_stopped_typing', data);
    });

    socket.on('disconnect', () => {
      logger.info(`🔌 Client disconnected: ${socket.id}`);
    });
  });
}
