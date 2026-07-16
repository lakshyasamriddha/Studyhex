-- ============================================================
-- StudyReck — SQLite schema (adapted from the provided
-- PostgreSQL database.sql so the app runs with zero setup).
-- Same tables/columns/constraints, translated to SQLite types.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT NOT NULL UNIQUE,
    email               TEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    email_verified      INTEGER NOT NULL DEFAULT 0,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (length(username) >= 3)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS sessions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token       TEXT NOT NULL UNIQUE,
    ip_address          TEXT,
    user_agent          TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);

CREATE TABLE IF NOT EXISTS password_resets (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reset_token         TEXT NOT NULL UNIQUE,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at          TEXT NOT NULL,
    used                INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(reset_token);

-- ---------------------------
-- PROFILE
-- ---------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name           TEXT,
    bio                 TEXT,
    profession          TEXT,
    class_name          TEXT,
    company             TEXT,
    job_title           TEXT,
    work_hours          TEXT,
    contact_email       TEXT,
    contact_phone       TEXT,
    profile_photo_url   TEXT,
    resume_url          TEXT,
    visibility          TEXT NOT NULL DEFAULT 'private'
                         CHECK (visibility IN ('public','private','friends')),
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_visibility ON profiles(visibility);

CREATE TABLE IF NOT EXISTS skills (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS profile_skills (
    profile_id          INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    skill_id            INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, skill_id)
);

-- ---------------------------
-- EDUCATION
-- ---------------------------
CREATE TABLE IF NOT EXISTS education (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id          INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    degree              TEXT,
    institution         TEXT,
    graduation_year     INTEGER CHECK (graduation_year BETWEEN 1950 AND 2100),
    field_of_study      TEXT,
    grade_summary       TEXT,
    marksheet_url       TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_education_profile ON education(profile_id);

-- ---------------------------
-- UPLOADED DOCUMENTS
-- ---------------------------
CREATE TABLE IF NOT EXISTS documents (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id          INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    doc_type            TEXT NOT NULL CHECK (doc_type IN ('certificate','marksheet','resume','other')),
    title               TEXT,
    file_url            TEXT NOT NULL,
    file_size_bytes     INTEGER,
    mime_type           TEXT,
    uploaded_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_profile ON documents(profile_id);

-- ---------------------------
-- CONNECTIONS
-- ---------------------------
CREATE TABLE IF NOT EXISTS connections (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_addressee ON connections(addressee_id);

-- ---------------------------
-- NOTIFICATION SETTINGS
-- ---------------------------
CREATE TABLE IF NOT EXISTS notification_settings (
    user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_reminders     INTEGER NOT NULL DEFAULT 1,
    deadline_alerts     INTEGER NOT NULL DEFAULT 1,
    achievement_alerts  INTEGER NOT NULL DEFAULT 1,
    weekly_summary      INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------
-- APP DATA
-- ---------------------------
CREATE TABLE IF NOT EXISTS subjects (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    color               TEXT,
    manual_progress     INTEGER DEFAULT 0 CHECK (manual_progress BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);

CREATE TABLE IF NOT EXISTS tasks (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    done                INTEGER NOT NULL DEFAULT 0,
    priority            TEXT NOT NULL DEFAULT 'med' CHECK (priority IN ('low','med','high')),
    deadline            TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);

CREATE TABLE IF NOT EXISTS notes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    title               TEXT,
    body                TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);

CREATE TABLE IF NOT EXISTS note_shares (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id             INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    owner_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (note_id, shared_with_id)
);

CREATE INDEX IF NOT EXISTS idx_note_shares_shared_with ON note_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_note_shares_note ON note_shares(note_id);

CREATE TABLE IF NOT EXISTS study_sessions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    mode                TEXT,
    seconds             INTEGER NOT NULL CHECK (seconds >= 0),
    session_date        TEXT NOT NULL,
    note                TEXT
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date ON study_sessions(user_id, session_date);

CREATE TABLE IF NOT EXISTS achievements_unlocked (
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id      TEXT NOT NULL,
    unlocked_at         TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, achievement_id)
);

-- ---------------------------
-- FORUM (ask questions, share study guides, get replies)
-- ---------------------------
CREATE TABLE IF NOT EXISTS forum_posts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    body                TEXT NOT NULL,
    tag                 TEXT,               -- free-text subject/topic tag, e.g. "Biology"
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON forum_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_forum_posts_tag ON forum_posts(tag);

CREATE TABLE IF NOT EXISTS forum_replies (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id             INTEGER NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body                TEXT NOT NULL,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON forum_replies(post_id);

-- ---------------------------
-- DIRECT MESSAGES
-- ---------------------------
CREATE TABLE IF NOT EXISTS messages (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body                TEXT NOT NULL,
    read_at             TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, recipient_id, created_at);
