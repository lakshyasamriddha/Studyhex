const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function areFriends(userIdA, userIdB) {
  const row = db.prepare(`
    SELECT 1 FROM connections
    WHERE status = 'accepted'
      AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
  `).get(userIdA, userIdB, userIdB, userIdA);
  return !!row;
}

// GET /api/notes -> my own notes
router.get('/', requireAuth, (req, res) => {
  const notes = db.prepare(
    'SELECT id, title, body, subject_id, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json({ notes });
});

// GET /api/notes/shared -> notes friends have shared with me
router.get('/shared', requireAuth, (req, res) => {
  const notes = db.prepare(`
    SELECT n.id, n.title, n.body, n.created_at, u.username AS shared_by, ns.created_at AS shared_at
    FROM note_shares ns
    JOIN notes n ON n.id = ns.note_id
    JOIN users u ON u.id = ns.owner_id
    WHERE ns.shared_with_id = ?
    ORDER BY ns.created_at DESC
  `).all(req.user.id);
  res.json({ notes });
});

// POST /api/notes  { title, body, subject_id }
router.post('/', requireAuth, (req, res) => {
  const { title, body, subject_id } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'body is required' });

  const result = db.prepare(
    'INSERT INTO notes (user_id, subject_id, title, body) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, subject_id || null, (title || '').trim() || null, body.trim());

  const note = db.prepare(
    'SELECT id, title, body, subject_id, created_at FROM notes WHERE id = ?'
  ).get(result.lastInsertRowid);

  res.status(201).json({ note });
});

// DELETE /api/notes/:id -> only the owner can delete
router.delete('/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Note not found' });
  res.json({ ok: true });
});

// GET /api/notes/:id/shares -> who a note has been shared with (owner only)
router.get('/:id/shares', requireAuth, (req, res) => {
  const note = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const shares = db.prepare(`
    SELECT u.username FROM note_shares ns JOIN users u ON u.id = ns.shared_with_id
    WHERE ns.note_id = ? ORDER BY u.username
  `).all(req.params.id);

  res.json({ shares: shares.map(s => s.username) });
});

// POST /api/notes/:id/share  { username }  -> share one of my notes with a friend
router.post('/:id/share', requireAuth, (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: 'username is required' });

  const note = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (!areFriends(req.user.id, target.id)) {
    return res.status(403).json({ error: 'You can only share notes with friends' });
  }

  db.prepare(
    'INSERT OR IGNORE INTO note_shares (note_id, owner_id, shared_with_id) VALUES (?, ?, ?)'
  ).run(req.params.id, req.user.id, target.id);

  res.status(201).json({ ok: true });
});

module.exports = router;
