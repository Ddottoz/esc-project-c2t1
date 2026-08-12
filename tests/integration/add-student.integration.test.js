/**
 * Integration tests for Add Student (POST /students).
 * No mocks — hits a real Express app instance backed by the real MySQL
 * database (via the pool from models/db.js). Verifies routing, validation,
 * duplicate-NRIC checking, and the actual DB insert all work correctly
 * together.
 *
 * SAFETY: nric is a real 9-character column so test rows can't carry a text marker inside
 * nric itself. Instead, every test row is marked via a fixed string in
 * `remarks`, and every inserted studentId is tracked precisely for
 * cleanup — contactPerson and studentSemBand rows are deleted before the
 * student row itself (no ON DELETE CASCADE assumed). A sweep also runs
 * in beforeAll and afterAll to clean up any leftover marked rows from a
 * previous run that crashed before cleanup could complete.
 *
 * Requires a real, reachable database (via .env DB_* config) —
 * this suite will fail to run without one, unlike the unit test suite.
 */

const request = require('supertest');
const express = require('express');
const pool = require('../../models/db');
const studentRouter = require('../../routes/student');

const app = express();
app.use(express.json());
app.use('/students', studentRouter);

const TEST_MARKER = 'TESTINT_MARKER_DO_NOT_EDIT';
function makeTestNric() {
    const digits = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
    return `T${digits}X`;
}

let validCentreId, validSchoolId, validEducatorId, validSemesterId;
const insertedStudentIds = [];

// deletes a student's dependent rows first (no cascade assumed), then the student row itself
async function cleanupStudent(studentId) {
    await pool.query('DELETE FROM contactPerson WHERE studentId = ?', [studentId]);
    await pool.query('DELETE FROM studentSemBand WHERE studentId = ?', [studentId]);
    await pool.query('DELETE FROM student WHERE studentId = ?', [studentId]);
}

async function sweepMarkedTestRows() {
    const [rows] = await pool.query('SELECT studentId FROM student WHERE remarks = ?', [TEST_MARKER]);
    for (const row of rows) {
        await cleanupStudent(row.studentId);
    }
}

// Look up real, currently-valid foreign key values rather than hardcoding assumed ones (keeps the test correct regardless of what's actually seeded in the database right now)
beforeAll(async () => {
    const [[centre]] = await pool.query('SELECT centreId FROM centre LIMIT 1');
    const [[school]] = await pool.query('SELECT schoolId FROM school LIMIT 1');
    const [[educator]] = await pool.query('SELECT educatorId FROM educator LIMIT 1');
    const [[semester]] = await pool.query('SELECT semesterId FROM semester LIMIT 1');

    validCentreId = centre.centreId;
    validSchoolId = school.schoolId;
    validEducatorId = educator.educatorId;
    validSemesterId = semester.semesterId;

    await sweepMarkedTestRows();
});

afterEach(async () => {
    for (const studentId of insertedStudentIds) {
        await cleanupStudent(studentId);
    }
    insertedStudentIds.length = 0;
});

afterAll(async () => {
    await sweepMarkedTestRows();
    await pool.end();
});

function buildValidPayload(nric) {
    return {
        firstName: 'Hee Hee',
        lastName: 'Tan',
        nric,
        dateOfBirth: '2015-05-01',
        centreId: validCentreId,
        schoolId: validSchoolId,
        educatorId: validEducatorId,
        schLevel: 'Secondary',
        currentBand: 'A1',
        semesterId: validSemesterId,
        contactPersons: [{
            contactName: 'Lim Lee Hui',
            phoneNumber: '+65 8121 9216',
            email: 'leehui@test.com',
            relationship: 'Mother',
            isPrimary: true
        }]
    };
}

describe('4.2.1 Integration Test: Add Student Successfully (Success Flow)', () => {
    test('creates a new student and its contact person record in the database', async () => {
        const nric = makeTestNric();
        const payload = buildValidPayload(nric);

        const res = await request(app).post('/students').send(payload);

        expect(res.status).toBe(201);
        expect(res.body.studentId).toBeDefined();
        insertedStudentIds.push(res.body.studentId);
        
        // verify it's actually persisted, not just a fabricated response
        const [rows] = await pool.query('SELECT * FROM student WHERE nric = ?', [nric]);
        expect(rows.length).toBe(1);
        expect(rows[0].firstName).toBe('Hee Hee');
        expect(rows[0].lastName).toBe('Tan');

        const [contacts] = await pool.query('SELECT * FROM contactPerson WHERE studentId = ?', [rows[0].studentId]);
        expect(contacts.length).toBe(1);
        expect(contacts[0].contactName).toBe('Lim Lee Hui');
        expect(Boolean(contacts[0].isPrimary)).toBe(true);
    });
});

describe('4.2.2 Integration Test: Invalid Input Details or Contact Rules', () => {
    test('rejects a submission with missing required fields and makes no DB changes', async () => {
        const nric = makeTestNric();
        const payload = buildValidPayload(nric);
        delete payload.firstName;

        const res = await request(app).post('/students').send(payload);

        expect(res.status).toBe(400);

        const [rows] = await pool.query('SELECT * FROM student WHERE nric = ?', [nric]);
        expect(rows.length).toBe(0);
    });

    test('rejects a submission with 0 primary contacts and makes no DB changes', async () => {
        const nric = makeTestNric();
        const payload = {...buildValidPayload(nric), contactPersons: []};

        const res = await request(app).post('/students').send(payload);
        expect(res.status).toBe(400);

        const [rows] = await pool.query('SELECT * FROM student WHERE nric = ?', [nric]);
        expect(rows.length).toBe(0);
    });
});

describe('4.2.3 Integration Test: Duplicate NRIC', () => {
    test('rejects a 2nd student using an NRIC that already exists in the database', async () => {
        const nric = makeTestNric();
        const payload = buildValidPayload(nric);

        const firstRes = await request(app).post('/students').send(payload);
        expect(firstRes.status).toBe(201);
        insertedStudentIds.push(firstRes.body.studentId);

        const secondPayload = {...buildValidPayload(nric), firstName: 'Hee Hee 2'};
        const secondRes = await request(app).post('/students').send(secondPayload);

        expect(secondRes.status).toBe(409);
        expect(secondRes.body.error).toMatch(/already exists/i);

        // confirm still only 1 row exists for this NRIC, not 2
        const [rows] = await pool.query('SELECT * FROM student WHERE nric = ?', [nric]);
        expect(rows.length).toBe(1);
    });
});