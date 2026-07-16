const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/forum/posts?query=&tag=
// Lists posts, most recent first. `query` searches title+body, `tag` filters exactly.
router.get('/posts', requireAuth, (req, res) => {
  const { query, tag } = req.query;

  let sql = `
    SELECT p.id, p.title, p.body, p.tag, p.created_at, u.username,
      (SELECT COUNT(*) FROM forum_replies r WHERE r.post_id = p.id) AS reply_count
    FROM forum_posts p
    JOIN users u ON u.id = p.user_id
    WHERE 1=1
  `;
  const params = [];

  if (query && query.trim()) {
    sql += ' AND (p.title LIKE ? OR p.body LIKE ?)';
    const like = `%${query.trim()}%`;
    params.push(like, like);
  }
  if (tag && tag.trim()) {
    sql += ' AND p.tag = ?';
    params.push(tag.trim());
  }

  sql += ' ORDER BY p.created_at DESC LIMIT 100';

  const posts = db.prepare(sql).all(...params);
  res.json({ posts });
});

// POST /api/forum/posts  { title, body, tag }
router.post('/posts', requireAuth, (req, res) => {
  const { title, body, tag } = req.body;
  if (!title || !title.trim() || !body || !body.trim()) {
    return res.status(400).json({ error: 'title and body are required' });
  }

  const result = db.prepare(
    'INSERT INTO forum_posts (user_id, title, body, tag) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, title.trim(), body.trim(), (tag || '').trim() || null);

  const post = db.prepare(`
    SELECT p.id, p.title, p.body, p.tag, p.created_at, u.username, 0 AS reply_count
    FROM forum_posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ post });
});

// GET /api/forum/posts/:id  -> post + all replies
router.get('/posts/:id', requireAuth, (req, res) => {
  const post = db.prepare(`
    SELECT p.id, p.title, p.body, p.tag, p.created_at, u.username, u.id AS user_id
    FROM forum_posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?
  `).get(req.params.id);

  if (!post) return res.status(404).json({ error: 'Post not found' });

  const replies = db.prepare(`
    SELECT r.id, r.body, r.created_at, u.username
    FROM forum_replies r JOIN users u ON u.id = r.user_id
    WHERE r.post_id = ? ORDER BY r.created_at ASC
  `).all(req.params.id);

  res.json({ post, replies });
});

// POST /api/forum/posts/:id/replies  { body }
router.post('/posts/:id/replies', requireAuth, (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'body is required' });

  const post = db.prepare('SELECT id FROM forum_posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const result = db.prepare(
    'INSERT INTO forum_replies (post_id, user_id, body) VALUES (?, ?, ?)'
  ).run(req.params.id, req.user.id, body.trim());

  const reply = db.prepare(`
    SELECT r.id, r.body, r.created_at, u.username
    FROM forum_replies r JOIN users u ON u.id = r.user_id WHERE r.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ reply });
});

// GET /api/forum/tags -> distinct tags in use, for the filter dropdown
router.get('/tags', requireAuth, (req, res) => {
  const rows = db.prepare(
    "SELECT DISTINCT tag FROM forum_posts WHERE tag IS NOT NULL AND tag != '' ORDER BY tag"
  ).all();
  res.json({ tags: rows.map(r => r.tag) });
});

module.exports = router;
