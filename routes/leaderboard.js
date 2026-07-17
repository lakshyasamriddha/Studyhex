const express = require("express");
const pool = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/leaderboard?range=week|month|all
router.get("/", requireAuth, async (req, res) => {
  try {
    const range = req.query.range || "all";

    let dateFilter = "";
    const params = [];

    if (range === "week") {
      dateFilter = "AND s.session_date >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (range === "month") {
      dateFilter = "AND s.session_date >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.username,
        p.full_name,
        p.profile_photo_url,
        COALESCE(SUM(s.seconds), 0) AS total_seconds,
        COUNT(DISTINCT s.session_date) AS active_days
      FROM users u
      LEFT JOIN profiles p
        ON p.user_id = u.id
      LEFT JOIN study_sessions s
        ON s.user_id = u.id ${dateFilter}
      WHERE u.is_active = TRUE
      GROUP BY
        u.id,
        u.username,
        p.full_name,
        p.profile_photo_url
      ORDER BY total_seconds DESC
      LIMIT 100
      `,
      params
    );

    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      userId: row.id,
      username: row.username,
      displayName: row.full_name || row.username,
      photoUrl: row.profile_photo_url,
      totalSeconds: Number(row.total_seconds),
      activeDays: Number(row.active_days),
      isMe: row.id === req.user.id,
    }));

    const me = leaderboard.find((r) => r.isMe) || null;

    res.json({
      range,
      leaderboard,
      me,
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({
      error: "Failed to load leaderboard",
    });
  }
});

module.exports = router;
