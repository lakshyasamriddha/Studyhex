require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const leaderboardRoutes = require('./routes/leaderboard');
const studyRoutes = require('./routes/study');
const forumRoutes = require('./routes/forum');
const messagesRoutes = require('./routes/messages');
const friendsRoutes = require('./routes/friends');
const notesRoutes = require('./routes/notes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.get('/api/debug/users', (req, res) => {
  const db = require('./db/init');
  const users = db.prepare('SELECT id, username, email FROM users').all();
  res.json(users);
});
app.use('/api/profile', profileRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/notes', notesRoutes);

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Fallback 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`StudyReck server running at http://localhost:${PORT}`);
});
