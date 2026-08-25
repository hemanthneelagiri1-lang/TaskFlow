const jwt = require('jsonwebtoken');
const { getDb } = require('../db/db');
const { mapUser } = require('../utils/formatters');

async function protect(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    const db = getDb();

    const row = await db.get(
      'SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!row) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = mapUser(row);
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  next();
}

module.exports = {
  protect,
  adminOnly,
};
