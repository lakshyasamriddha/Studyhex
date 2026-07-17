const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/init');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await db.prepare('SELECT id FROM users WHERE email = ? OR username = ?')
      .get(email, username);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already in use' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const insertUser = db.prepare(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?) RETURNING id'
    );
    const result = await insertUser.run(username, email, passwordHash);
    const userId = result.lastInsertRowid;

    // create an empty profile + default notification settings for the new user
    await db.prepare('INSERT INTO profiles (user_id, full_name) VALUES (?, ?)').run(userId, username);
    await db.prepare('INSERT INTO notification_settings (user_id) VALUES (?)').run(userId);

    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    setAuthCookie(res, token);
    res.status(201).json({ user: { id: userId, username, email }, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: 'emailOrUsername and password are required' });
    }

    const user = await db.prepare(
      'SELECT * FROM users WHERE email = ? OR username = ?'
    ).get(emailOrUsername, emailOrUsername);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });
    setAuthCookie(res, token);
    res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// PUT /api/auth/username  { username }
router.put('/username', requireAuth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'username is required' });
    }
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    const taken = await db.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .get(trimmed, req.user.id);
    if (taken) return res.status(409).json({ error: 'That username is already taken' });

    await db.prepare('UPDATE users SET username = ?, updated_at = NOW() WHERE id = ?')
      .run(trimmed, req.user.id);

    const token = jwt.sign({ id: req.user.id, username: trimmed }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });
    setAuthCookie(res, token);
    res.json({ user: { id: req.user.id, username: trimmed } });
  } catch (err) {
    console.error('Update username error:', err);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?')
      .get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
