const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'grc-secret-change-in-production';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user.isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin, JWT_SECRET };
