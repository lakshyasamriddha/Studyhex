const express = require("express");
const pool = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/study/subjects
router.get("/subjects", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM subjects WHERE user_id = $1 ORDER BY id",
      [req.user.id]
    );

    res.json({ subjects: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get subjects" });
  }
});

// POST /api/study/subjects
router.post("/subjects", requireAuth, async (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const result = await pool.query(
      `INSERT INTO subjects (user_id, name, color)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, name, color || null]
    );

    res.status(201).json({
      subject: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create subject" });
  }
});

// POST /api/study/sessions
router.post("/sessions", requireAuth, async (req, res) => {
  try {
    const {
      subject_id,
      mode,
      seconds,
      session_date,
      note
    } = req.body;

    if (seconds === undefined || seconds < 0) {
      return res.status(400).json({
        error: "seconds must be >= 0"
      });
    }

    const date =
      session_date || new Date().toISOString().slice(0, 10);

    const result = await pool.query(
      `INSERT INTO study_sessions
       (user_id, subject_id, mode, seconds, session_date, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.user.id,
        subject_id || null,
        mode || null,
        seconds,
        date,
        note || null
      ]
    );

    res.status(201).json({
      session: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to save session"
    });
  }
});

// GET /api/study/sessions/summary
router.get("/sessions/summary", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        COALESCE(SUM(seconds), 0) AS total_seconds,
        COUNT(DISTINCT session_date) AS active_days,
        COUNT(*) AS session_count
       FROM study_sessions
       WHERE user_id = $1`,
      [req.user.id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to get summary"
    });
  }
});

module.exports = router;
