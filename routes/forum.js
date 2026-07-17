const express = require("express");
const pool = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/forum/posts
router.get("/posts", requireAuth, async (req, res) => {
  try {
    const { query, tag } = req.query;

    let sql = `
      SELECT 
        p.id,
        p.title,
        p.body,
        p.tag,
        p.created_at,
        u.username,
        (
          SELECT COUNT(*)
          FROM forum_replies r
          WHERE r.post_id = p.id
        ) AS reply_count
      FROM forum_posts p
      JOIN users u ON u.id = p.user_id
      WHERE 1=1
    `;

    const params = [];
    let index = 1;

    if (query && query.trim()) {
      sql += ` AND (p.title ILIKE $${index} OR p.body ILIKE $${index})`;
      params.push(`%${query.trim()}%`);
      index++;
    }

    if (tag && tag.trim()) {
      sql += ` AND p.tag = $${index}`;
      params.push(tag.trim());
    }

    sql += " ORDER BY p.created_at DESC LIMIT 100";

    const result = await pool.query(sql, params);

    res.json({ posts: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get posts" });
  }
});


// POST /api/forum/posts
router.post("/posts", requireAuth, async (req, res) => {
  try {
    const { title, body, tag } = req.body;

    if (!title || !title.trim() || !body || !body.trim()) {
      return res.status(400).json({
        error: "title and body are required"
      });
    }

    const result = await pool.query(
      `INSERT INTO forum_posts
       (user_id, title, body, tag)
       VALUES ($1,$2,$3,$4)
       RETURNING id`,
      [
        req.user.id,
        title.trim(),
        body.trim(),
        tag?.trim() || null
      ]
    );

    const post = await pool.query(
      `SELECT 
        p.id,
        p.title,
        p.body,
        p.tag,
        p.created_at,
        u.username,
        0 AS reply_count
       FROM forum_posts p
       JOIN users u ON u.id=p.user_id
       WHERE p.id=$1`,
      [result.rows[0].id]
    );

    res.status(201).json({
      post: post.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to create post"
    });
  }
});


module.exports = router;
	
