const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/study/subjects
router.get('/subjects', requireAuth, (req, res) => {
  const subjects = db.prepare('SELECT * FROM subjects WHERE user_id = ? ORDER BY id').all(req.user.id);
  res.json({ subjects });
});

// POST /api/study/subjects
router.post('/subjects', requireAuth, (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = db.prepare('INSERT INTO subjects (user_id, name, color) VALUES (?, ?, ?)')
    .run(req.user.id, name, color || null);
  const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ subject });
});

// POST /api/study/sessions  (log a completed study session -> feeds leaderboard)
router.post('/sessions', requireAuth, (req, res) => {
  const { subject_id, mode, seconds, session_date, note } = req.body;
  if (!seconds || seconds < 0) return res.status(400).json({ error: 'seconds must be >= 0' });

  const date = session_date || new Date().toISOString().slice(0, 10);
  const result = db.prepare(
    'INSERT INTO study_sessions (user_id, subject_id, mode, seconds, session_date, note) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, subject_id || null, mode || null, seconds, date, note || null);

  const session = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ session });
});

// GET /api/study/sessions/summary  (totals for the logged-in user - used on profile/dashboard)
router.get('/sessions/summary', requireAuth, (req, res) => {
  const row = db.prepare(
    `SELECT COALESCE(SUM(seconds), 0) AS total_seconds,
            COUNT(DISTINCT session_date) AS active_days,
            COUNT(*) AS session_count
     FROM study_sessions WHERE user_id = ?`
  ).get(req.user.id);
  res.json(row);
});

module.exports = router;
