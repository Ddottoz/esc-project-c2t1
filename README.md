# ESC-DAS

Login and Sign Up pages for the DAS (Dyslexia Association of Singapore) platform —
university group project. React + Vite frontend, Express + MySQL backend with
full auth (bcrypt-hashed passwords, JWT sessions).

## Stack

- **Frontend:** React 18, Vite, react-router-dom, lucide-react, plain CSS
- **Backend:** Node.js, Express, mysql2, bcrypt, jsonwebtoken
- **Database:** MySQL 8+

## Prerequisites

- Node.js 18+ and npm
- MySQL server running locally

### Preparing MySQL (macOS, Homebrew)

```bash
brew install mysql
brew services start mysql          # starts now + on login
mysqladmin ping                     # should print "mysqld is alive"
```

By default the Homebrew `root` user has **no password** on localhost, which
matches the committed `.env.example`. If your MySQL root has a password, set it
in `server/.env` (see below).

> Note: if you have an Anaconda MySQL, its `mysql` command may shadow Homebrew's
> in your PATH. Use the full path `/opt/homebrew/opt/mysql/bin/mysql` if `mysql`
> connects to the wrong server.

## Setup

### 1. Backend

```bash
cd server
npm install
cp .env.example .env                # then edit .env if your DB creds differ

# create the database + users table
/opt/homebrew/opt/mysql/bin/mysql -u root < schema.sql
# (or just: mysql -u root < schema.sql  if mysql points at Homebrew)

# insert test users
npm run seed

# start the API (http://localhost:5001)
npm run dev                         # nodemon, auto-restarts
# or: npm start
```

### 2. Frontend

```bash
cd client
npm install
npm run dev                         # http://localhost:5173
```

Open http://localhost:5173 — it redirects to `/login`.

## Test accounts (from `npm run seed`)

| Email             | Password       | Role     |
| ----------------- | -------------- | -------- |
| educator@das.org  | Password123!   | educator |
| admin@das.org     | Admin123!      | admin    |

Access is restricted to **educators and administrators**. Public sign-ups are
created as `educator`; admins are provisioned via the seed / database. Any
`student` account is rejected at login with a `403`.

## Environment (`server/.env`)

| Var           | Default                 | Notes                          |
| ------------- | ----------------------- | ------------------------------ |
| DB_HOST       | localhost               |                                |
| DB_PORT       | 3306                    |                                |
| DB_USER       | root                    |                                |
| DB_PASSWORD   | (empty)                 | set if your root has a password |
| DB_NAME       | esc_das                 |                                |
| JWT_SECRET    | change-me-...           | use a long random string       |
| PORT          | 5001                    | API port                       |
| CLIENT_ORIGIN | http://localhost:5173   | CORS allowlist                 |

The client can override the API URL with `VITE_API_URL` (defaults to
`http://localhost:5001/api`).

## API

| Method | Path               | Body                                          | Success        |
| ------ | ------------------ | --------------------------------------------- | -------------- |
| POST   | `/api/auth/signup` | `{ name, email, password, confirmPassword }`  | `201 { token, user }` |
| POST   | `/api/auth/login`  | `{ email, password }`                         | `200 { token, user }` |
| GET    | `/api/health`      | —                                             | `{ ok: true }` |

Validation errors return `400`, duplicate signup email `409`, bad login `401`
(`"Invalid email or password"` — does not reveal which field was wrong).

## Project structure

```
ESC-DAS/
├── PLAN.md            # original implementation plan
├── client/            # Vite + React frontend
│   └── src/
│       ├── pages/         Login, Signup, Welcome
│       ├── components/    AuthLayout, SidePanel, InputField, Logo
│       ├── styles/auth.css
│       └── api.js
└── server/            # Express + MySQL backend
    ├── index.js  db.js  seed.js  schema.sql
    ├── routes/auth.js
    └── middleware/auth.js   # JWT verify, for future protected routes
```

## Notes / out of scope

- "Forgot Password?" is a placeholder link (not wired up yet).
- The DAS logo is an approximated SVG (`client/src/components/Logo.jsx`) — swap in
  the real exported asset when available.
- After auth, `/welcome` is a minimal placeholder proving the flow; replace with a
  real dashboard in a later phase.
```
