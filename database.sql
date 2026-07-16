-- ============================================================
-- StudyReck — Accounts & Profile Schema
-- Compatible with PostgreSQL and MySQL 8+ (see notes below)
-- ============================================================
-- NOTES:
-- * Written for PostgreSQL. For MySQL: replace SERIAL -> INT AUTO_INCREMENT,
--   TIMESTAMPTZ -> DATETIME, BOOLEAN -> TINYINT(1), and TEXT CHECK(...) enums
--   with VARCHAR + CHECK (MySQL 8.0.16+ supports CHECK) or ENUM(...).
-- * Never store plain-text passwords. `password_hash` must hold a bcrypt/
--   argon2 hash generated server-side — this schema only stores the hash.
-- * File upload columns store PATH/URL only, never file bytes.
-- ============================================================

-- ---------------------------
-- USERS & AUTH
-- ---------------------------
CREATE TABLE users (
    id                  SERIAL PRIMARY KEY,
    username            VARCHAR(30)  NOT NULL UNIQUE,
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    email_verified      BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Active login sessions (or JWT refresh-token tracking)
CREATE TABLE sessions (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token       VARCHAR(255) NOT NULL UNIQUE,
    ip_address          VARCHAR(45),
    user_agent          VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(session_token);

-- Password reset flow ("Forgot Password")
CREATE TABLE password_resets (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reset_token         VARCHAR(255) NOT NULL UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    used                BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_password_resets_token ON password_resets(reset_token);

-- ---------------------------
-- PROFILE
-- ---------------------------
CREATE TABLE profiles (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name           VARCHAR(120),
    bio                 TEXT,
    profession          VARCHAR(120),
    company             VARCHAR(120),
    job_title           VARCHAR(120),
    work_hours          VARCHAR(60),          -- e.g. "Mon-Fri 9am-5pm"
    contact_email       VARCHAR(255),          -- optional public contact, distinct from login email
    contact_phone       VARCHAR(30),
    profile_photo_url   VARCHAR(500),
    resume_url          VARCHAR(500),
    visibility          VARCHAR(10) NOT NULL DEFAULT 'private'
                         CHECK (visibility IN ('public','private','friends')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_visibility ON profiles(visibility);

-- Skills are many-to-many so they can be searched/reused across users
CREATE TABLE skills (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE profile_skills (
    profile_id          INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    skill_id            INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, skill_id)
);

-- ---------------------------
-- EDUCATION
-- ---------------------------
CREATE TABLE education (
    id                  SERIAL PRIMARY KEY,
    profile_id          INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    degree              VARCHAR(150),
    institution         VARCHAR(150),
    graduation_year     SMALLINT CHECK (graduation_year BETWEEN 1950 AND 2100),
    field_of_study      VARCHAR(150),
    grade_summary       VARCHAR(60),           -- e.g. GPA, percentage, class
    marksheet_url       VARCHAR(500),          -- uploaded file path only
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_education_profile ON education(profile_id);

-- ---------------------------
-- UPLOADED DOCUMENTS (certificates, extra files)
-- ---------------------------
CREATE TABLE documents (
    id                  SERIAL PRIMARY KEY,
    profile_id          INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    doc_type            VARCHAR(30) NOT NULL
                         CHECK (doc_type IN ('certificate','marksheet','resume','other')),
    title               VARCHAR(150),
    file_url            VARCHAR(500) NOT NULL,  -- path/URL only, never raw bytes
    file_size_bytes     INTEGER,
    mime_type           VARCHAR(100),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_profile ON documents(profile_id);

-- ---------------------------
-- PRIVACY / CONNECTIONS (for "friends only" visibility)
-- ---------------------------
CREATE TABLE connections (
    id                  SERIAL PRIMARY KEY,
    requester_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status               VARCHAR(10) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','accepted','blocked')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (requester_id, addressee_id),
    CONSTRAINT no_self_connection CHECK (requester_id <> addressee_id)
);

CREATE INDEX idx_connections_addressee ON connections(addressee_id);

-- ---------------------------
-- NOTIFICATION SETTINGS
-- ---------------------------
CREATE TABLE notification_settings (
    user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_reminders     BOOLEAN NOT NULL DEFAULT TRUE,
    deadline_alerts     BOOLEAN NOT NULL DEFAULT TRUE,
    achievement_alerts  BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_summary      BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---------------------------
-- EXISTING APP DATA — scoped to a user
-- (mirrors the current localStorage model: subjects, tasks, notes, sessions)
-- ---------------------------
CREATE TABLE subjects (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(120) NOT NULL,
    color               VARCHAR(20),
    manual_progress     SMALLINT DEFAULT 0 CHECK (manual_progress BETWEEN 0 AND 100)
);

CREATE INDEX idx_subjects_user ON subjects(user_id);

CREATE TABLE tasks (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    title               VARCHAR(255) NOT NULL,
    done                BOOLEAN NOT NULL DEFAULT FALSE,
    priority            VARCHAR(10) NOT NULL DEFAULT 'med'
                         CHECK (priority IN ('low','med','high')),
    deadline            DATE
);

CREATE INDEX idx_tasks_user ON tasks(user_id);

CREATE TABLE notes (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    title               VARCHAR(255),
    body                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_user ON notes(user_id);

CREATE TABLE study_sessions (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    mode                VARCHAR(20),
    seconds             INTEGER NOT NULL CHECK (seconds >= 0),
    session_date        DATE NOT NULL,
    note                TEXT
);

CREATE INDEX idx_sessions_user_date ON study_sessions(user_id, session_date);

CREATE TABLE achievements_unlocked (
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id      VARCHAR(50) NOT NULL,
    unlocked_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);

-- ---------------------------
-- TRIGGER: keep updated_at fresh (Postgres syntax)
-- ---------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
