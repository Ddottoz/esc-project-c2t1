/**
 * Integration tests for UC20: Edit Educator Account (POST /educator).
 * No mocks — a real Express app instance backed by the real MySQL database
 * (via the pool from models/db.js). Two educators are seeded through the real
 * model: the one being edited, and a second one that already owns an email, so
 * the "email already in use" rule can be exercised against real data.
 *
 * SAFETY: both seeded educators are marked by TEST_MARKER inside educatorName
 * and use throwaway @test.invalid emails that are unique per run. They are
 * removed in afterAll, and a sweep by marker runs in beforeAll and afterAll to
 * clear anything left behind by a run that crashed before cleanup finished.
 *
 * Requires a real, reachable database (via .env DB_* config) —
 * this suite will fail to run without one, unlike the unit test suite.
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('../../models/db');
const EducatorModel = require('../../models/educator');
const educatorRouter = require('../../routes/educator');

// mirrors app.js: the route reads the logged-in educator from a cookie and renders an EJS page
const app = express();
app.set('views', path.join(__dirname, '../../views'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use('/educator', educatorRouter);

const TEST_MARKER = 'TESTINT_EDU_DO_NOT_EDIT';
const ORIGINAL_PASSWORD = 'Password123';

let editableId, editableEmail;
let otherEmail;

function makeTestEmail() {
    return `testint_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.invalid`;
}

// posts the profile form as the logged-in educator
function submitProfile(form) {
    return request(app)
        .post('/educator')
        .set('Cookie', [`educatorId=${editableId}`])
        .type('form')
        .send(form);
}

function buildValidForm(overrides = {}) {
    return {
        firstName: 'Hee Hee',
        lastName: `Tan ${TEST_MARKER}`,
        email: editableEmail,
        newPassword: '',
        confirmPassword: '',
        ...overrides
    };
}

async function sweepMarkedTestRows() {
    await pool.query('DELETE FROM educator WHERE educatorName LIKE ?', [`%${TEST_MARKER}%`]);
}

beforeAll(async () => {
    await sweepMarkedTestRows();

    editableEmail = makeTestEmail();
    otherEmail = makeTestEmail();

    editableId = await EducatorModel.createEducator(
        `Hee Hee Tan ${TEST_MARKER}`, editableEmail, ORIGINAL_PASSWORD
    );
    await EducatorModel.createEducator(
        `Other Educator ${TEST_MARKER}`, otherEmail, ORIGINAL_PASSWORD
    );
});

// put the editable educator back to its starting state after each test
afterEach(async () => {
    await pool.query(
        'UPDATE educator SET educatorName = ?, email = ? WHERE educatorId = ?',
        [`Hee Hee Tan ${TEST_MARKER}`, editableEmail, editableId]
    );
});

afterAll(async () => {
    await sweepMarkedTestRows();
    await pool.end();
});


describe('20.2.1 Integration Test: Edit Educator Account Successfully (Success Flow)', () => {
    test('saves the updated name and email to the database', async () => {
        const newEmail = makeTestEmail();

        const res = await submitProfile(buildValidForm({firstName: 'Updated', email: newEmail}));

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/changes saved/i);

        const [rows] = await pool.query('SELECT * FROM educator WHERE educatorId = ?', [editableId]);
        expect(rows[0].educatorName).toContain('Updated');
        expect(rows[0].email).toBe(newEmail);
    });

    test('replaces the stored password hash when a new password is entered', async () => {
        const res = await submitProfile(buildValidForm({
            newPassword: 'NewPassword123',
            confirmPassword: 'NewPassword123'
        }));

        expect(res.status).toBe(200);

        const [rows] = await pool.query('SELECT passwordHash FROM educator WHERE educatorId = ?', [editableId]);
        expect(await bcrypt.compare('NewPassword123', rows[0].passwordHash)).toBe(true);
        expect(await bcrypt.compare(ORIGINAL_PASSWORD, rows[0].passwordHash)).toBe(false);

        // put the original password back so later tests start from a known state
        await EducatorModel.updatePassword(editableId, ORIGINAL_PASSWORD);
    });

    test('leaves the password unchanged when both password fields are blank', async () => {
        await submitProfile(buildValidForm({firstName: 'NoPasswordChange'}));

        const [rows] = await pool.query('SELECT passwordHash FROM educator WHERE educatorId = ?', [editableId]);
        expect(await bcrypt.compare(ORIGINAL_PASSWORD, rows[0].passwordHash)).toBe(true);
    });
});


describe('20.2.2 Integration Test: Email Already Used by Another Educator', () => {
    test('rejects an email another educator owns and makes no DB changes', async () => {
        const res = await submitProfile(buildValidForm({email: otherEmail}));

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/already using that email/i);

        const [rows] = await pool.query('SELECT email FROM educator WHERE educatorId = ?', [editableId]);
        expect(rows[0].email).toBe(editableEmail);
    });
});


describe('20.2.3 Integration Test: Required Details Missing or Invalid', () => {
    test('rejects a form with no first name and makes no DB changes', async () => {
        const res = await submitProfile(buildValidForm({firstName: ''}));

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/required/i);

        const [rows] = await pool.query('SELECT educatorName FROM educator WHERE educatorId = ?', [editableId]);
        expect(rows[0].educatorName).toContain('Hee Hee');
    });

    test('rejects a new password shorter than 8 characters and makes no DB changes', async () => {
        const res = await submitProfile(buildValidForm({newPassword: 'Pass1', confirmPassword: 'Pass1'}));

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/at least 8 characters/i);

        const [rows] = await pool.query('SELECT passwordHash FROM educator WHERE educatorId = ?', [editableId]);
        expect(await bcrypt.compare(ORIGINAL_PASSWORD, rows[0].passwordHash)).toBe(true);
    });

    test('rejects mismatched passwords and makes no DB changes', async () => {
        const res = await submitProfile(buildValidForm({
            newPassword: 'NewPassword123',
            confirmPassword: 'NewPassword456'
        }));

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/do not match/i);

        const [rows] = await pool.query('SELECT passwordHash FROM educator WHERE educatorId = ?', [editableId]);
        expect(await bcrypt.compare(ORIGINAL_PASSWORD, rows[0].passwordHash)).toBe(true);
    });
});
