# StudyReck

A small full-stack study tracker: login/register, an editable profile, a
focus-session timer, and a leaderboard ranked by total focused time.

Everything runs from this one folder — clone it, install, and start.

## Stack

- **Backend:** Node.js + Express
- **Database:** SQLite via Node's **built-in** `node:sqlite` module — a single
  file, `studyreck.db`, created automatically on first run. No separate
  database server, and no native module to compile (this matters on Termux/
  Android, where compiling `better-sqlite3` fails — this project avoids that
  entirely). Requires **Node.js 22.5+**. (`db/schema.sql` is adapted from the
  original PostgreSQL schema in `database.sql`; the two are equivalent, just
  different SQL dialects.)
- **Auth:** JWT stored in an httpOnly cookie, passwords hashed with bcrypt
- **Frontend:** plain HTML/CSS/JS served as static files — no build step

## Run it

```bash
npm install
cp .env.example .env      # then edit JWT_SECRET to a random string
npm start
```

Open **http://localhost:3000** in your browser. Create an account, then use
the sidebar to move between Dashboard, Profile, and Leaderboard.

For auto-restart on file changes during development:

```bash
npm run dev
```

## Project layout

```
studyreck/
├── server.js              Express app entry point
├── db/
│   ├── schema.sql         SQLite schema (tables, indexes, checks)
│   └── init.js            Opens studyreck.db and applies the schema
├── middleware/
│   └── auth.js            JWT verification middleware
├── routes/
│   ├── auth.js            /api/auth  — register, login, logout, me
│   ├── profile.js         /api/profile — view/edit profile, skills, public view
│   ├── leaderboard.js     /api/leaderboard — ranks users by focused time
│   ├── study.js           /api/study — subjects + session logging
│   └── forum.js           /api/forum — posts, replies, search, tags
├── public/                Static frontend
│   ├── index.html          Login / register
│   ├── dashboard.html      Focus timer, subjects, totals
│   ├── profile.html        Edit profile + skills
│   ├── leaderboard.html    Ranked list, filterable by range
│   ├── forum.html          Ask questions, share study guides, search
│   ├── forum-post.html     Single thread + replies
│   ├── css/style.css
│   └── js/                 One file per page + shared api.js helper
├── database.sql            Original PostgreSQL schema (reference / production)
├── .env.example
└── package.json
```

## API summary

| Method | Path                     | Auth | Description                          |
|--------|---------------------------|------|--------------------------------------|
| POST   | /api/auth/register         | no   | Create account, sets session cookie  |
| POST   | /api/auth/login            | no   | Log in, sets session cookie          |
| POST   | /api/auth/logout           | yes  | Clear session cookie                 |
| GET    | /api/auth/me               | yes  | Current user                         |
| GET    | /api/profile/me            | yes  | Your full profile                    |
| PUT    | /api/profile/me            | yes  | Update profile + skills              |
| GET    | /api/profile/:username     | no   | Public profile (respects visibility) |
| GET    | /api/study/subjects        | yes  | List your subjects                   |
| POST   | /api/study/subjects        | yes  | Create a subject                     |
| POST   | /api/study/sessions        | yes  | Log a focus session                  |
| GET    | /api/study/sessions/summary| yes  | Your total time / active days        |
| GET    | /api/leaderboard?range=    | yes  | Ranked users (`all`, `month`, `week`)|
| GET    | /api/forum/posts?query=&tag=| yes | List/search posts                    |
| POST   | /api/forum/posts           | yes  | Create a post                        |
| GET    | /api/forum/posts/:id       | yes  | Post detail + replies                |
| POST   | /api/forum/posts/:id/replies| yes | Add a reply                          |
| GET    | /api/forum/tags            | yes  | Distinct topic tags in use            |

## Moving to PostgreSQL later

The app currently uses SQLite so it runs with zero setup. If you outgrow it,
`database.sql` (the original schema you provided) already targets Postgres —
swap `db/init.js` for a `pg` connection pool and adjust the parameterized
queries (`?` → `$1, $2, ...`) in the `routes/` files.

## Security notes

- Passwords are hashed with bcrypt before storage — never stored in plain text.
- Sessions use an httpOnly, sameSite cookie so the JWT isn't reachable from
  page JavaScript.
- Set a strong, random `JWT_SECRET` in `.env` before deploying anywhere real.
- `contact_phone` is stripped from the public profile response.
