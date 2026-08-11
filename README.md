# ESC Project C2T1 — DAS

Express + EJS web app for the Dyslexia Association of Singapore.
The database is MySQL, hosted on Railway and shared by the whole team.

## Setup

```
npm install
```

Create a `.env` file in the project root (copy `.env.example`) and fill in the
Railway connection details:

```
DB_HOST=tokaido.proxy.rlwy.net
DB_PORT=11059
DB_USER=root
DB_PASSWORD=<ask the team>
DB_NAME=railway
```

`.env` is gitignored, so the password never goes into the repository.

Then start the app:

```
npm start
```

It runs on http://localhost:3000

## Pages

| Page | URL |
| --- | --- |
| Login | /login |
| Register | /register |
| Edit Educator Information | /educator |
| Add / Edit Student | /add-edit-student.html |

## Edit Educator Information

Reached by clicking the profile icon in the navbar. Lets an educator edit their
name and email, and change their password (hashed with bcrypt).

Two things are not real yet:

- There is no login, so `routes/educator.js` always edits the educator whose id
  is in `CURRENT_EDUCATOR_ID`. Replace that with the logged in educator once
  auth exists.
- The DAS Programme Information table shows placeholder rows. The database has
  no table linking an educator to a semester, band and role, so there is nothing
  real to read yet.

## Layout

```
models/     database queries (one file per table)
routes/     express routes
views/      ejs pages, with shared pieces in views/partials
public/     stylesheets, client side javascript, images
```
