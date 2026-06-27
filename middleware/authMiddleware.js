// Placeholder for authMiddleware.js
const authMiddleware = (req, res, next) => {
  // Mock user for testing purposes
  req.user = { id: 'test-user-id', role: 'admin' };
  next();
};

module.exports = authMiddleware;
