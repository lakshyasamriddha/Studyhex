const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/leaderboard?range=week|month|all
router.get('/', requireAuth, (req, res) => {
  const range = req.query.range || 'all';

  let dateFilter = '';
  if (range === 'week') {
    dateFilter = "AND session_date >= date('now', '-7 days')";
  } else if (range === 'month') {
    dateFilter = "AND session_date >= date('now', '-30 days')";
  }

  const rows = db.prepare(`
    SELECT
      u.id,
      u.username,
      p.full_name,
      p.profile_photo_url,
      COALESCE(SUM(s.seconds), 0) AS total_seconds,
      COUNT(DISTINCT s.session_date) AS active_days
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN study_sessions s ON s.user_id = u.id ${dateFilter}
    WHERE u.is_active = 1
    GROUP BY u.id
    ORDER BY total_seconds DESC
    LIMIT 100
  `).all();

  const leaderboard = rows.map((row, idx) => ({
    rank: idx + 1,
    userId: row.id,
    username: row.username,
    displayName: row.full_name || row.username,
    photoUrl: row.profile_photo_url,
    totalSeconds: row.total_seconds,
    activeDays: row.active_days,
    isMe: row.id === req.user.id
  }));

  const me = leaderboard.find(r => r.isMe) || null;

  res.json({ range, leaderboard, me });
});

module.exports = router;
