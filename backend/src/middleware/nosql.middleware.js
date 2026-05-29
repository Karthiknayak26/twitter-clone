/**
 * Middleware to protect against NoSQL injection attacks by sanitizing
 * user-supplied data in request body, query, and params.
 * It recursively deletes keys that start with '$' or contain '.'.
 */
function sanitizeObject(obj) {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key];
        } else {
          sanitizeObject(obj[key]);
        }
      }
    }
  }
}

export const nosqlSanitize = (req, res, next) => {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
};
