const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { getDb } = require('../db/db');
const { protect } = require('../middleware/auth');
const { mapUser } = require('../utils/formatters');

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '7d',
  });
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();

    if (!cleanName) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const db = getDb();
    const exists = await db.get('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (exists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const userId = randomUUID();
    const hashed = await bcrypt.hash(String(password), 10);
    const safeRole = role === 'admin' ? 'admin' : 'user';

    await db.run(
      'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [userId, cleanName, cleanEmail, hashed, safeRole]
    );

    const row = await db.get(
      'SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?',
      [userId]
    );

    return res.status(201).json({
      token: signToken(userId),
      user: mapUser(row),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const db = getDb();
    const row = await db.get('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);

    if (!row) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(String(password), row.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = mapUser(row);
    return res.json({ token: signToken(row.id), user });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/me', protect, (req, res) => {
  res.json(req.user);
});

module.exports = router;
