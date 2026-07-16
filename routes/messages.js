const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/messages/conversations
// Lists the most recent message with each person the user has messaged/been messaged by,
// most recently active conversation first, plus a count of unread messages from them.
router.get('/conversations', requireAuth, (req, res) => {
  const myId = req.user.id;

  const rows = db.prepare(`
    SELECT
      u.id AS user_id,
      u.username,
      p.profile_photo_url,
      m.body AS last_body,
      m.created_at AS last_at,
      m.sender_id AS last_sender_id,
      (
        SELECT COUNT(*) FROM messages m2
        WHERE m2.sender_id = u.id AND m2.recipient_id = ? AND m2.read_at IS NULL
      ) AS unread_count
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE m.id IN (
      SELECT MAX(id) FROM messages
      WHERE sender_id = ? OR recipient_id = ?
      GROUP BY CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END
    )
    ORDER BY m.created_at DESC
  `).all(myId, myId, myId, myId, myId);

  res.json({ conversations: rows });
});

// GET /api/messages/unread/count -> for a nav badge
// (declared before /:username so "unread" doesn't get parsed as a username)
router.get('/unread/count', requireAuth, (req, res) => {
  const row = db.prepare(
    'SELECT COUNT(*) AS count FROM messages WHERE recipient_id = ? AND read_at IS NULL'
  ).get(req.user.id);
  res.json({ count: row.count });
});

// GET /api/messages/:username  -> full thread with that user, oldest first.
// Also marks any unread messages from them as read.
router.get('/:username', requireAuth, (req, res) => {
  const other = db.prepare('SELECT id, username FROM users WHERE username = ?')
    .get(req.params.username);
  if (!other) return res.status(404).json({ error: 'User not found' });
  if (other.id === req.user.id) {
    return res.status(400).json({ error: "You can't message yourself" });
  }

  db.prepare(`
    UPDATE messages SET read_at = datetime('now')
    WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL
  `).run(other.id, req.user.id);

  const thread = db.prepare(`
    SELECT id, sender_id, recipient_id, body, created_at, read_at
    FROM messages
    WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
    ORDER BY created_at ASC
    LIMIT 500
  `).all(req.user.id, other.id, other.id, req.user.id);

  res.json({ user: other, messages: thread });
});

// POST /api/messages/:username  { body }
router.post('/:username', requireAuth, (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'body is required' });

  const other = db.prepare('SELECT id, username FROM users WHERE username = ?')
    .get(req.params.username);
  if (!other) return res.status(404).json({ error: 'User not found' });
  if (other.id === req.user.id) {
    return res.status(400).json({ error: "You can't message yourself" });
  }

  const result = db.prepare(
    'INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)'
  ).run(req.user.id, other.id, body.trim());

  const message = db.prepare(
    'SELECT id, sender_id, recipient_id, body, created_at, read_at FROM messages WHERE id = ?'
  ).get(result.lastInsertRowid);

  res.status(201).json({ message });
});

module.exports = router;
