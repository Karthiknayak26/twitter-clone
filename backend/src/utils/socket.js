let ioInstance = null;

/**
 * Stores the active Socket.IO server instance.
 * @param {object} io - Socket.IO server instance
 */
export const setIo = (io) => {
  ioInstance = io;
};

/**
 * Retrieves the stored Socket.IO server instance.
 * @returns {object} Stored Socket.IO server instance
 */
export const getIo = () => {
  return ioInstance;
};
