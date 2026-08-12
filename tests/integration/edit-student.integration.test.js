/**
 * Integration tests for Edit Student (PUT /students/:studentId).
 * No mocks — hits a real Express app instance backed by the real MySQL
 * database (via the pool from models/db.js). Verifies routing, validation,
 * and the actual DB update all work correctly together.
 *
 * Unlike Add Student, editing requires a student to already exist, so each
 * test first seeds one baseline student directly via SQL (test setup, not
 * the thing under test), then exercises the real PUT route against it.
 *
 * SAFETY: same marker-based approach as add-student.integration.test.js —
 * every seeded/created row is tagged via `remarks`, and every studentId is
 * tracked precisely for cleanup (contactPerson + studentSemBand deleted
 * before the student row itself). A sweep also runs in beforeAll/afterAll
 * to clean up any leftover marked rows from a previous crashed run.
 *
 * Requires a real, reachable database (via your .env DB_* config).
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

// Seeds 1 baseline student + 1 primary contact directly via SQL so each test starts from a known, pre-existing record to edit
async function insertBaselineStudent() {
    const nric = makeTestNric();
    const [result] = await pool.query(`
        INSERT into student (firstName, lastName, nric, enrolmentDate, currentSemester, age, dateOfBirth, schoolLevel, centreId, schoolId, educatorId, currentBand, remarks) VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['Hee Hee', 'Tan', nric, validSemesterId, 10, '2015-05-01', 'Secondary', validCentreId, validSchoolId, validEducatorId, 'A1', TEST_MARKER]);
    const studentId = result.insertId;
    insertedStudentIds.push(studentId);

    await pool.query(`
        INSERT INTO contactPerson (studentId, contactName, phoneNumber, email, relationship, isPrimary) VALUES (?, ?, ?, ?, ?, ?)`, [studentId, 'Lim Lee Hui', '+65 8121 9216', 'leehui@test.com', 'Mother', 1]);

    return studentId;
}

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

function buildValidUpdatePayload() {
    return {
        centreId: validCentreId,
        schoolId: validSchoolId,
        educatorId: validEducatorId,
        schLevel: 'Secondary',
        currentBand: 'A2',
        semesterId: validSemesterId,
        remarks: TEST_MARKER,
        contactPersons: [{
            contactName: 'Ben Tan',
            phoneNumber: '+65 8256 9583',
            email: 'bentan@test.com',
            relationship: 'Father',
            isPrimary: true
        }]
    };
}

describe('9.2.1 Integration Test: Edit Student Profile & Contacts Successfully (Success Flow)', () => {
    test('updates an existing student profile and replaces its contact person records in database', async () => {
        const studentId = await insertBaselineStudent();
        const payload = buildValidUpdatePayload();

        const res = await request(app).put(`/students/${studentId}`).send(payload);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({studentId});
        
        const [rows] = await pool.query('SELECT * FROM student WHERE studentId = ?', [studentId]);
        expect(rows.length).toBe(1);
        expect(rows[0].currentBand).toBe('A2');

        // setContactsForStudent does delete-then-reinsert, so the old "Lim Lee Hui" contact should be gone & replaced by the new one
        const [contacts] = await pool.query('SELECT * FROM contactPerson WHERE studentId = ?', [studentId]);
        expect(contacts.length).toBe(1);
        expect(contacts[0].contactName).toBe('Ben Tan');
        expect(Boolean(contacts[0].isPrimary)).toBe(true);
    });

    test('returns 404 and makes no changes when the studentId does not exist', async () => {
        const nonExistentId = 999999999;
        const payload = buildValidUpdatePayload();

        const res = await request(app).put(`/students/${nonExistentId}`).send(payload);

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/student not found/i);
    });
});

describe('9.2.2 Integration Test: Invalid INput Details or Contact Rules', () => {
    test('rejects a submission with a missing required field and makes no changes to the database', async () => {
        const studentId = await insertBaselineStudent();
        const payload = buildValidUpdatePayload();
        delete payload.centreId;

        const res = await request(app).put(`/students/{studentId}`).send(payload);
        expect(res.status).toBe(400);

        // confirm the original band is untouched not overwritten
        const [rows] = await pool.query('SELECT * FROM student WHERE studentId = ?', [studentId]);
        expect(rows[0].currentBand).toBe('A1');

        const [contacts] = await pool.query('SELECT * FROM contactPerson WHERE studentId = ?', [studentId]);
        expect(contacts.length).toBe(1);
        expect(contacts[0].contactName).toBe('Lim Lee Hui'); // not replaced
    });

    test('rejects a submission with 0 primary contacts and makes no changes to the database', async () => {
        const studentId = await insertBaselineStudent();
        const payload = {...buildValidUpdatePayload(), contactPersons: []};

        const res = await request(app).put(`/students/${studentId}`).send(payload);
        expect(res.status).toBe(400);

        const [contacts] = await pool.query('SELECT * FROM contactPerson WHERE studentId = ?', [studentId]);
        expect(contacts.length).toBe(1);
        expect(contacts[0].contactName).toBe('Lim Lee Hui');
    });
});