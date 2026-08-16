/**
 * Integration tests for UC5: Create Educator Account (POST /register).
 * No mocks — a real Express app instance backed by the real MySQL database
 * (via the pool from models/db.js). Verifies routing, form validation, the
 * duplicate email check and the actual DB insert all work together.
 *
 * SAFETY: every educator created here is marked by TEST_MARKER inside
 * educatorName, and uses a throwaway @test.invalid email that is unique per
 * run. Rows are deleted by email in afterEach, and a sweep by marker runs in
 * beforeAll and afterAll to clear anything left behind by a run that crashed
 * before cleanup finished.
 *
 * Requires a real, reachable database (via .env DB_* config) —
 * this suite will fail to run without one, unlike the unit test suite.
 */

const request = require('supertest');
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('../../models/db');
const registerRouter = require('../../routes/register');

// mirrors app.js: the register route renders an EJS page when the form is rejected
const app = express();
app.set('views', path.join(__dirname, '../../views'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: false}));
app.use('/register', registerRouter);

const TEST_MARKER = 'TESTINT_EDU_DO_NOT_EDIT';
const VALID_PASSWORD = 'Password123';

const insertedEmails = [];

function makeTestEmail() {
    return `testint_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.invalid`;
}

function buildValidForm(email) {
    return {
        name: `Hee Hee Tan ${TEST_MARKER}`,
        email: email,
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD
    };
}

function submitForm(form) {
    return request(app).post('/register').type('form').send(form);
}

async function sweepMarkedTestRows() {
    await pool.query('DELETE FROM educator WHERE educatorName LIKE ?', [`%${TEST_MARKER}%`]);
}

beforeAll(async () => {
    await sweepMarkedTestRows();
});

afterEach(async () => {
    for (const email of insertedEmails) {
        await pool.query('DELETE FROM educator WHERE email = ?', [email]);
    }
    insertedEmails.length = 0;
});

afterAll(async () => {
    await sweepMarkedTestRows();
    await pool.end();
});


describe('5.2.1 Integration Test: Create Educator Account Successfully (Success Flow)', () => {
    test('creates the educator in the database and logs them straight in', async () => {
        const email = makeTestEmail();
        insertedEmails.push(email);

        const res = await submitForm(buildValidForm(email));

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/educator');
        expect(String(res.headers['set-cookie'])).toContain('educatorId');

        // verify it is actually persisted, not just a redirect
        const [rows] = await pool.query('SELECT * FROM educator WHERE email = ?', [email]);
        expect(rows.length).toBe(1);
        expect(rows[0].educatorName).toContain('Hee Hee Tan');
    });

    test('stores the password as a bcrypt hash, never as plain text', async () => {
        const email = makeTestEmail();
        insertedEmails.push(email);

        await submitForm(buildValidForm(email));

        const [rows] = await pool.query('SELECT passwordHash FROM educator WHERE email = ?', [email]);
        expect(rows[0].passwordHash).not.toBe(VALID_PASSWORD);
        expect(await bcrypt.compare(VALID_PASSWORD, rows[0].passwordHash)).toBe(true);
    });
});


describe('5.2.2 Integration Test: Account Already Exists', () => {
    test('rejects a 2nd account using an email that is already registered', async () => {
        const email = makeTestEmail();
        insertedEmails.push(email);

        const firstRes = await submitForm(buildValidForm(email));
        expect(firstRes.status).toBe(302);

        const secondRes = await submitForm(buildValidForm(email));

        expect(secondRes.status).toBe(200);
        expect(secondRes.text).toMatch(/already exists/i);

        // confirm still only 1 row exists for this email, not 2
        const [rows] = await pool.query('SELECT * FROM educator WHERE email = ?', [email]);
        expect(rows.length).toBe(1);
    });
});


describe('5.2.3 Integration Test: Required Details Missing or Invalid', () => {
    test('rejects a form with no name and makes no DB changes', async () => {
        const email = makeTestEmail();
        const form = {...buildValidForm(email), name: ''};

        const res = await submitForm(form);

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/required/i);

        const [rows] = await pool.query('SELECT * FROM educator WHERE email = ?', [email]);
        expect(rows.length).toBe(0);
    });

    test('rejects a password shorter than 8 characters and makes no DB changes', async () => {
        const email = makeTestEmail();
        const form = {...buildValidForm(email), password: 'Pass1', confirmPassword: 'Pass1'};

        const res = await submitForm(form);

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/at least 8 characters/i);

        const [rows] = await pool.query('SELECT * FROM educator WHERE email = ?', [email]);
        expect(rows.length).toBe(0);
    });

    test('rejects mismatched passwords and makes no DB changes', async () => {
        const email = makeTestEmail();
        const form = {...buildValidForm(email), confirmPassword: 'Password456'};

        const res = await submitForm(form);

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/do not match/i);

        const [rows] = await pool.query('SELECT * FROM educator WHERE email = ?', [email]);
        expect(rows.length).toBe(0);
    });
});
