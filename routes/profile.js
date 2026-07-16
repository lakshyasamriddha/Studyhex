const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function getProfileWithSkills(userId) {
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
  if (!profile) return null;

  const skills = db.prepare(
    `SELECT s.name FROM skills s
     JOIN profile_skills ps ON ps.skill_id = s.id
     WHERE ps.profile_id = ?`
  ).all(profile.id).map(r => r.name);

  const education = db.prepare(
    'SELECT * FROM education WHERE profile_id = ? ORDER BY graduation_year DESC'
  ).all(profile.id);

  return { ...profile, skills, education };
}

// GET /api/profile/me
router.get('/me', requireAuth, (req, res) => {
  const profile = getProfileWithSkills(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json({ profile });
});

// PUT /api/profile/me
router.put('/me', requireAuth, (req, res) => {
  const {
    full_name, bio, profession, class_name, company, job_title, work_hours,
    contact_email, contact_phone, profile_photo_url, visibility, skills
  } = req.body;

  const existing = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(req.user.id);
  if (!existing) return res.status(404).json({ error: 'Profile not found' });

  // Only touch profile_photo_url when the client actually sent the field —
  // otherwise editing an unrelated field (bio, skills, etc.) would silently wipe the photo.
  const hasPhotoField = Object.prototype.hasOwnProperty.call(req.body, 'profile_photo_url');

  db.prepare(`
    UPDATE profiles SET
      full_name = ?, bio = ?, profession = ?, class_name = ?, company = ?, job_title = ?,
      work_hours = ?, contact_email = ?, contact_phone = ?,
      profile_photo_url = CASE WHEN ? = 1 THEN ? ELSE profile_photo_url END,
      visibility = COALESCE(?, visibility),
      updated_at = datetime('now')
    WHERE user_id = ?
  `).run(
    full_name || null, bio || null, profession || null, class_name || null, company || null, job_title || null,
    work_hours || null, contact_email || null, contact_phone || null,
    hasPhotoField ? 1 : 0, profile_photo_url || null,
    visibility || null, req.user.id
  );

  // Replace skill associations if a skills array was sent
  if (Array.isArray(skills)) {
    const profileId = existing.id;
    db.prepare('DELETE FROM profile_skills WHERE profile_id = ?').run(profileId);

    const findSkill = db.prepare('SELECT id FROM skills WHERE name = ?');
    const insertSkill = db.prepare('INSERT INTO skills (name) VALUES (?)');
    const linkSkill = db.prepare('INSERT OR IGNORE INTO profile_skills (profile_id, skill_id) VALUES (?, ?)');

    for (const raw of skills) {
      const name = String(raw).trim();
      if (!name) continue;
      let row = findSkill.get(name);
      if (!row) {
        const r = insertSkill.run(name);
        row = { id: r.lastInsertRowid };
      }
      linkSkill.run(profileId, row.id);
    }
  }

  const updated = getProfileWithSkills(req.user.id);
  res.json({ profile: updated });
});

// GET /api/profile/:username  (public view, respects visibility)
router.get('/:username', (req, res) => {
  const user = db.prepare('SELECT id, username FROM users WHERE username = ?')
    .get(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const profile = getProfileWithSkills(user.id);
  if (!profile || profile.visibility === 'private') {
    return res.status(403).json({ error: 'This profile is private' });
  }

  const { contact_phone, ...safe } = profile; // never expose phone publicly
  res.json({ username: user.username, profile: safe });
});

module.exports = router;
