const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/friends -> accepted friends, either side of the connection
router.get('/', requireAuth, (req, res) => {
  const myId = req.user.id;
  const rows = db.prepare(`
    SELECT u.id, u.username, p.profile_photo_url
    FROM connections c
    JOIN users u ON u.id = CASE WHEN c.requester_id = ? THEN c.addressee_id ELSE c.requester_id END
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE c.status = 'accepted' AND (c.requester_id = ? OR c.addressee_id = ?)
    ORDER BY u.username
  `).all(myId, myId, myId);
  res.json({ friends: rows });
});

// GET /api/friends/requests -> pending requests sent TO me
router.get('/requests', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.id AS connection_id, u.id AS user_id, u.username, p.profile_photo_url, c.created_at
    FROM connections c
    JOIN users u ON u.id = c.requester_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE c.status = 'pending' AND c.addressee_id = ?
    ORDER BY c.created_at DESC
  `).all(req.user.id);
  res.json({ requests: rows });
});

// POST /api/friends/request/:username -> send a friend request
router.post('/request/:username', requireAuth, (req, res) => {
  const target = db.prepare('SELECT id, username FROM users WHERE username = ?')
    .get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) {
    return res.status(400).json({ error: "You can't friend yourself" });
  }

  const existing = db.prepare(`
    SELECT * FROM connections
    WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
  `).get(req.user.id, target.id, target.id, req.user.id);

  if (existing) {
    if (existing.status === 'accepted') {
      return res.status(409).json({ error: 'Already friends' });
    }
    return res.status(409).json({ error: 'A request already exists between you two' });
  }

  db.prepare('INSERT INTO connections (requester_id, addressee_id, status) VALUES (?, ?, ?)')
    .run(req.user.id, target.id, 'pending');

  res.status(201).json({ ok: true });
});

// POST /api/friends/accept/:username -> accept a pending request from that user
router.post('/accept/:username', requireAuth, (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const result = db.prepare(`
    UPDATE connections SET status = 'accepted'
    WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'
  `).run(target.id, req.user.id);

  if (result.changes === 0) return res.status(404).json({ error: 'No pending request from that user' });
  res.json({ ok: true });
});

// POST /api/friends/decline/:username -> decline/cancel a pending request either direction
router.post('/decline/:username', requireAuth, (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const result = db.prepare(`
    DELETE FROM connections
    WHERE status = 'pending'
      AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
  `).run(target.id, req.user.id, req.user.id, target.id);

  if (result.changes === 0) return res.status(404).json({ error: 'No pending request found' });
  res.json({ ok: true });
});

// DELETE /api/friends/:username -> remove an accepted friend
router.delete('/:username', requireAuth, (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const result = db.prepare(`
    DELETE FROM connections
    WHERE status = 'accepted'
      AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
  `).run(target.id, req.user.id, req.user.id, target.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Not friends with that user' });
  res.json({ ok: true });
});

module.exports = router;
