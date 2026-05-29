import logger from '../utils/logger.js';

// In-memory store to mock Redis — now with proper TTL support
const store = new Map();       // key → value
const expiries = new Map();    // key → expiry timestamp (ms)

/**
 * Checks if a key has expired and evicts it if so.
 * Returns true if the key is still alive, false if expired/missing.
 */
function isAlive(key) {
  if (!store.has(key)) return false;
  const expiresAt = expiries.get(key);
  if (expiresAt && Date.now() > expiresAt) {
    // Key has expired — evict
    store.delete(key);
    expiries.delete(key);
    return false;
  }
  return true;
}

const redisClient = {
  get: async (key) => {
    if (!isAlive(key)) return null;
    return store.get(key);
  },

  setEx: async (key, ttlSeconds, val) => {
    store.set(key, val);
    expiries.set(key, Date.now() + (ttlSeconds * 1000));
  },

  del: async (key) => {
    store.delete(key);
    expiries.delete(key);
  },

  ttl: async (key) => {
    if (!isAlive(key)) return -2; // Key doesn't exist or is expired
    const expiresAt = expiries.get(key);
    if (!expiresAt) return -1;   // Key exists but has no TTL
    const remainingMs = expiresAt - Date.now();
    return Math.max(0, Math.ceil(remainingMs / 1000));
  },

  on: (event, handler) => {
    if (event === 'connect') handler();
  },

  connect: async () => {
    logger.info('✅ Connected to Mock Redis with TTL support.');
  }
};

export default redisClient;
