# ESC-DAS — Implementation Plan: Login & Sign Up Pages

Plan for recreating the two Figma pages (Login, Sign Up) for the DAS (Dyslexia Association of Singapore) platform. University group project. This document is the single source of truth for the implementing model — follow it top to bottom.

## Decisions already made (do not re-ask)

- **Frontend:** React 18 + Vite, plain CSS (CSS modules or a single stylesheet — no Tailwind).
- **Routing:** react-router-dom v6 (`/login`, `/signup`; `/` redirects to `/login`).
- **Backend:** Node.js + Express, `mysql2/promise`, `bcrypt`, `jsonwebtoken`, `cors`, `dotenv`.
- **Database:** MySQL (local instance). Full auth flow implemented now, but seeded with **test data only**.
- **Assets:** No Figma exports available. Approximate from the screenshot (see Design Spec). Use a placeholder logo box with the DAS mark recreated as text/SVG if needed.

## Repo layout (monorepo, two packages)

```
ESC-DAS/
├── PLAN.md
├── README.md              # setup: MySQL, .env, install, run both servers
├── client/                # Vite + React
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx        # routes
│   │   ├── api.js         # fetch wrapper pointing at the Express server
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   └── Signup.jsx
│   │   ├── components/
│   │   │   ├── AuthLayout.jsx    # two-panel card shared by both pages
│   │   │   ├── SidePanel.jsx     # red panel (title, subtitle, outline button)
│   │   │   └── InputField.jsx    # grey pill input with leading icon
│   │   └── styles/auth.css
│   └── ...vite boilerplate
└── server/
    ├── index.js           # Express app entry
    ├── db.js              # mysql2 pool from .env
    ├── routes/auth.js     # POST /api/auth/signup, POST /api/auth/login
    ├── middleware/auth.js # JWT verify (for future protected routes)
    ├── schema.sql         # CREATE DATABASE/TABLE
    ├── seed.js            # inserts test users (bcrypt-hashed)
    ├── .env.example
    └── package.json
```

## Design spec (approximated from the Figma screenshot)

- **Palette:**
  - Primary red: `#D93831` (buttons, headings, side panel background)
  - White: `#FFFFFF` (card background, text on red)
  - Input grey: `#F1F1F1` background, `#8A8A8A` placeholder/icon
  - Body text: `#333` on white
- **Typography:** Google Font **Poppins** (fallback: Nunito, sans-serif). Headings bold (~700); "Login"/"Sign Up" page titles in red, ~36px. Side-panel headings ("New Here?", "Have an account?") white, bold, ~32px, with small subtitle text below (~13px).
- **Layout:** Centered card, roughly 950×640px, `border-radius: 0` (card edges look square in the mock), split into two columns:
  - **Login page:** red panel LEFT (~40% width), white form RIGHT.
  - **Sign Up page:** white form LEFT, red panel RIGHT (mirrored).
  - DAS logo square (~56px) pinned top-left of the card on both pages.
- **Red side panel contents:** heading, one-line subtitle ("Register to create an account" / "Sign in to your account"), and a white **pill button** (white bg, red text, bold, ~radius 9999px) that navigates to the other page ("Sign Up" ↔ "Login").
- **Form column contents:**
  - Title in red, centered ("Login" / "Sign Up")
  - Subtitle: "Enter your details below" (small, grey/black)
  - Inputs: grey rounded-rect (radius ~10px), leading icon (use `lucide-react` icons: mail, lock, user), placeholder text. Login: Email, Password. Signup: Name, Email, Password, Confirm Password.
  - Login only: right-aligned "Forgot Password?" small link below the password field (non-functional for now — plain link, no route).
  - Submit: red pill button, white bold text ("Login" / "Sign Up"), centered.
- **Page background** outside the card: dark (`#1a1a12`-ish per screenshot) — acceptable to use a neutral dark `#141414`.
- Responsive: below ~768px, stack panels vertically (red panel on top); not pixel-critical.

## Database schema (`server/schema.sql`)

```sql
CREATE DATABASE IF NOT EXISTS esc_das;
USE esc_das;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('student','educator','admin') DEFAULT 'student',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

`role` is included now (default `'student'`) so later phases don't need a migration; signup does not expose it.

## Seed data (`server/seed.js`)

Insert 2–3 test users with bcrypt-hashed passwords, e.g.:
- `test@das.org` / `Password123!` (name "Test Student")
- `admin@das.org` / `Admin123!` (role `admin`)

Idempotent: `INSERT ... ON DUPLICATE KEY UPDATE name = VALUES(name)` or check-before-insert.

## API contract

Base URL `http://localhost:5001/api` (5000 often taken on macOS). CORS allowed for the Vite origin (default `http://localhost:5173`).

### POST `/api/auth/signup`
- Body: `{ name, email, password, confirmPassword }`
- Server validation: all fields required; valid email format; password ≥ 8 chars; `password === confirmPassword`; email not already registered (`409` if it is).
- On success: bcrypt-hash (10 rounds), insert, return `201 { token, user: { id, name, email, role } }` (JWT signed with `JWT_SECRET`, 7-day expiry).
- Errors: `400` with `{ error: "<message>" }`, `409` for duplicate email.

### POST `/api/auth/login`
- Body: `{ email, password }`
- Look up by email, `bcrypt.compare`. Wrong email OR wrong password both return `401 { error: "Invalid email or password" }` (do not reveal which).
- Success: `200 { token, user: { id, name, email, role } }`.

### `.env.example`
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=esc_das
JWT_SECRET=change-me
PORT=5001
```

## Frontend behavior

- `api.js`: small `fetch` wrapper; on auth success store `token` + `user` in `localStorage` and redirect to `/login` → for now, since no dashboard exists, show a success state (e.g. redirect signup → `/login` with a "Account created, please log in" banner; login success → simple inline "Logged in as <name>" message or placeholder `/welcome` route — implementer's choice, keep minimal).
- Client-side validation before submit (mirrors server rules); show field-level or single form-level error text in red below the form. Disable submit button + "..." label while the request is in flight.
- Password fields use `type="password"`. No show/hide toggle needed (not in the mock).

## Implementation order

1. Scaffold: `npm create vite@latest client -- --template react`; `server/` with `npm init -y` + deps. Root README with run instructions (`npm run dev` in client, `node index.js` or `nodemon` in server).
2. DB: write `schema.sql`, apply it (`mysql -u root < server/schema.sql`), write and run `seed.js`.
3. Backend: `db.js` pool → auth routes → manual test with `curl` (signup new user, login seeded user, duplicate email, wrong password).
4. Frontend static UI: `AuthLayout`, `SidePanel`, `InputField`, both pages, `auth.css` — match the design spec side-by-side with the screenshot.
5. Wire forms to the API, add validation and loading/error states.
6. Verify end-to-end in the browser: signup a fresh user, confirm the row appears in MySQL, log out (clear localStorage), log in with the seeded test user, check error paths (duplicate email, mismatched passwords, bad login).

## Acceptance checklist

- [ ] `/login` and `/signup` visually match the screenshot (panel sides mirrored correctly).
- [ ] Cross-navigation buttons on the red panels work both directions.
- [ ] Signup creates a MySQL row with a bcrypt hash (never plaintext).
- [ ] Login works for seeded users and newly signed-up users; returns a JWT.
- [ ] Duplicate email → clear error; mismatched passwords → clear error; wrong credentials → generic "Invalid email or password".
- [ ] No secrets committed: `.env` gitignored, `.env.example` present.

## Out of scope (later phases)

Forgot-password flow, email verification, role-based dashboards, protected routes/pages beyond auth, deployment.
