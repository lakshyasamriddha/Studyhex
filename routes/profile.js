const express = require("express");
const pool = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

async function getProfileWithSkills(userId) {
  const profileResult = await pool.query(
    "SELECT * FROM profiles WHERE user_id = $1",
    [userId]
  );

  if (profileResult.rows.length === 0) return null;

  const profile = profileResult.rows[0];

  const skillsResult = await pool.query(
    `SELECT s.name
     FROM skills s
     JOIN profile_skills ps ON ps.skill_id = s.id
     WHERE ps.profile_id = $1`,
    [profile.id]
  );

  const educationResult = await pool.query(
    `SELECT *
     FROM education
     WHERE profile_id = $1
     ORDER BY graduation_year DESC`,
    [profile.id]
  );

  return {
    ...profile,
    skills: skillsResult.rows.map(r => r.name),
    education: educationResult.rows
  };
}

// GET /api/profile/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const profile = await getProfileWithSkills(req.user.id);

    if (!profile) {
      return res.status(404).json({
        error: "Profile not found"
      });
    }

    res.json({ profile });

  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).json({
      error: "Failed to fetch profile"
    });
  }
});
// PUT /api/profile/me
router.put("/me", requireAuth, async (req, res) => {
  try {
    const {
      full_name,
      bio,
      profession,
      company,
      job_title,
      work_hours,
      contact_email,
      contact_phone,
      profile_photo_url,
      visibility,
      skills
    } = req.body;

    const existingResult = await pool.query(
      "SELECT id FROM profiles WHERE user_id = $1",
      [req.user.id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: "Profile not found"
      });
    }

    const profileId = existingResult.rows[0].id;

    await pool.query(
      `UPDATE profiles SET
        full_name = $1,
        bio = $2,
        profession = $3,
        company = $4,
        job_title = $5,
        work_hours = $6,
        contact_email = $7,
        contact_phone = $8,
        profile_photo_url = COALESCE($9, profile_photo_url),
        visibility = COALESCE($10, visibility),
        updated_at = NOW()
      WHERE user_id = $11`,
      [
        full_name || null,
        bio || null,
        profession || null,
        company || null,
        job_title || null,
        work_hours || null,
        contact_email || null,
        contact_phone || null,
        profile_photo_url || null,
        visibility || null,
        req.user.id
      ]
    );

    if (Array.isArray(skills)) {
      await pool.query(
        "DELETE FROM profile_skills WHERE profile_id = $1",
        [profileId]
      );

      for (const raw of skills) {
        const name = String(raw).trim();
        if (!name) continue;

        let skill = await pool.query(
          "SELECT id FROM skills WHERE name = $1",
          [name]
        );

        let skillId;

        if (skill.rows.length === 0) {
          const inserted = await pool.query(
            "INSERT INTO skills (name) VALUES ($1) RETURNING id",
            [name]
          );
          skillId = inserted.rows[0].id;
        } else {
          skillId = skill.rows[0].id;
        }

        await pool.query(
          "INSERT INTO profile_skills (profile_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [profileId, skillId]
        );
      }
    }

    const updated = await getProfileWithSkills(req.user.id);
    res.json({ profile: updated });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to update profile"
    });
  }
});

// GET /api/profile/:username
router.get("/:username", async (req, res) => {
  try {
    const userResult = await pool.query(
      "SELECT id, username FROM users WHERE username = $1",
      [req.params.username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    const user = userResult.rows[0];
    const profile = await getProfileWithSkills(user.id);

    if (!profile || profile.visibility === "private") {
      return res.status(403).json({
        error: "This profile is private"
      });
    }

    const { contact_phone, ...safe } = profile;

    res.json({
      username: user.username,
      profile: safe
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to fetch profile"
    });
  }
});

module.exports = router;
