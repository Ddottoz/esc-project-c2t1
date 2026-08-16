/**
 * Integration tests for UC6: Login to Educator Account (POST /login).
 * No mocks — a real Express app instance backed by the real MySQL database
 * (via the pool from models/db.js). One educator is seeded through the real
 * model, then signed in through the real route, so the password hashing done
 * at sign up and the check done at login are proven to agree.
 *
 * SAFETY: the seeded educator is marked by TEST_MARKER inside educatorName and
 * uses a throwaway @test.invalid email that is unique per run. It is removed in
 * afterAll, and a sweep by marker runs in beforeAll and afterAll to clear
 * anything left behind by a run that crashed before cleanup finished.
 *
 * Requires a real, reachable database (via .env DB_* config) —
 * this suite will fail to run without one, unlike the unit test suite.
 */

const request = require('supertest');
const express = require('express');
const path = require('path');
const pool = require('../../models/db');
const EducatorModel = require('../../models/educator');
const loginRouter = require('../../routes/login');

// mirrors app.js: the login route renders an EJS page when the credentials are rejected
const app = express();
app.set('views', path.join(__dirname, '../../views'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: false}));
app.use('/login', loginRouter);

const TEST_MARKER = 'TESTINT_EDU_DO_NOT_EDIT';
const CORRECT_PASSWORD = 'Password123';

let seededEmail;
let seededEducatorId;

function submitLogin(email, password) {
    return request(app).post('/login').type('form').send({email, password});
}

async function sweepMarkedTestRows() {
    await pool.query('DELETE FROM educator WHERE educatorName LIKE ?', [`%${TEST_MARKER}%`]);
}

// seed one real educator to log in as, created through the real model so the
// password is hashed exactly the way sign up would hash it
beforeAll(async () => {
    await sweepMarkedTestRows();

    seededEmail = `testint_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.invalid`;
    seededEducatorId = await EducatorModel.createEducator(
        `Hee Hee Tan ${TEST_MARKER}`, seededEmail, CORRECT_PASSWORD
    );
});

afterAll(async () => {
    await pool.query('DELETE FROM educator WHERE email = ?', [seededEmail]);
    await sweepMarkedTestRows();
    await pool.end();
});


describe('6.2.1 Integration Test: Login Successfully (Success Flow)', () => {
    test('signs the educator in and remembers who they are', async () => {
        const res = await submitLogin(seededEmail, CORRECT_PASSWORD);

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/educator');
        expect(String(res.headers['set-cookie'])).toContain(`educatorId=${seededEducatorId}`);
    });
});


describe('6.2.2 Integration Test: Incorrect Credentials', () => {
    test('rejects a correct email with the wrong password and sets no cookie', async () => {
        const res = await submitLogin(seededEmail, 'WrongPassword');

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/incorrect email or password/i);
        expect(res.headers['set-cookie']).toBeUndefined();
    });

    test('rejects an empty password and sets no cookie (boundary case)', async () => {
        const res = await submitLogin(seededEmail, '');

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/incorrect email or password/i);
        expect(res.headers['set-cookie']).toBeUndefined();
    });
});


describe('6.2.3 Integration Test: No Account for That Email', () => {
    test('rejects an email that is not registered and sets no cookie', async () => {
        const res = await submitLogin('nobody_testint@test.invalid', CORRECT_PASSWORD);

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/incorrect email or password/i);
        expect(res.headers['set-cookie']).toBeUndefined();
    });
});
