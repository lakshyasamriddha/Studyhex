const express = require("express");
const pool = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();


// GET /api/messages/conversations
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const myId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        u.id AS user_id,
        u.username,
        p.profile_photo_url,
        m.body AS last_body,
        m.created_at AS last_at,
        m.sender_id AS last_sender_id,
        (
          SELECT COUNT(*)
          FROM messages m2
          WHERE m2.sender_id = u.id
          AND m2.recipient_id = $1
          AND m2.read_at IS NULL
        ) AS unread_count
      FROM messages m
      JOIN users u
        ON u.id = CASE
          WHEN m.sender_id = $1 THEN m.recipient_id
          ELSE m.sender_id
        END
      LEFT JOIN profiles p
        ON p.user_id = u.id
      WHERE m.id IN (
        SELECT MAX(id)
        FROM messages
        WHERE sender_id = $1 OR recipient_id = $1
        GROUP BY CASE
          WHEN sender_id = $1 THEN recipient_id
          ELSE sender_id
        END
      )
      ORDER BY m.created_at DESC
      `,
      [myId]
    );

    res.json({
      conversations: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to get conversations"
    });
  }
});


// GET unread count
router.get("/unread/count", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM messages
      WHERE recipient_id = $1
      AND read_at IS NULL
      `,
      [req.user.id]
    );

    res.json({
      count: Number(result.rows[0].count)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to get unread count"
    });
  }
});


// GET thread
router.get("/:username", requireAuth, async (req, res) => {
  try {
    const otherResult = await pool.query(
      "SELECT id, username FROM users WHERE username = $1",
      [req.params.username]
    );

    if (otherResult.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const other = otherResult.rows[0];

    if (other.id === req.user.id)
      return res.status(400).json({
        error: "You can't message yourself"
      });

    await pool.query(
      `
      UPDATE messages
      SET read_at = NOW()
      WHERE sender_id = $1
      AND recipient_id = $2
      AND read_at IS NULL
      `,
      [other.id, req.user.id]
    );

    const thread = await pool.query(
      `
      SELECT id, sender_id, recipient_id, body, created_at, read_at
      FROM messages
      WHERE
        (sender_id = $1 AND recipient_id = $2)
        OR
        (sender_id = $2 AND recipient_id = $1)
      ORDER BY created_at ASC
      LIMIT 500
      `,
      [req.user.id, other.id]
    );

    res.json({
      user: other,
      messages: thread.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to get messages"
    });
  }
});


// POST message
router.post("/:username", requireAuth, async (req, res) => {
  try {
    const { body } = req.body;

    if (!body || !body.trim())
      return res.status(400).json({
        error: "body is required"
      });

    const otherResult = await pool.query(
      "SELECT id, username FROM users WHERE username = $1",
      [req.params.username]
    );

    if (otherResult.rows.length === 0)
      return res.status(404).json({
        error: "User not found"
      });

    const other = otherResult.rows[0];

    if (other.id === req.user.id)
      return res.status(400).json({
        error: "You can't message yourself"
      });


    const result = await pool.query(
      `
      INSERT INTO messages
      (sender_id, recipient_id, body)
      VALUES ($1,$2,$3)
      RETURNING id, sender_id, recipient_id, body, created_at, read_at
      `,
      [
        req.user.id,
        other.id,
        body.trim()
      ]
    );

    res.status(201).json({
      message: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to send message"
    });
  }
});


module.exports = router;	
