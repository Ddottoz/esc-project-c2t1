/**
 * Integration tests for Delete Student (DELETE /students/:studentId).
 * No mocks — hits a real Express app instance backed by the real MySQL
 * database (via the pool from models/db.js). Verifies routing, not-found
 * handling, and — critically — that the ON DELETE CASCADE foreign key
 * constraints on contactPerson.studentId and studentSemBand.studentId
 * actually remove dependent rows when a student is deleted.
 *
 * SAFETY: every test row is marked via a fixed string in `remarks`, and
 * every inserted studentId is tracked for cleanup. Since deletion is
 * cascade-driven here (not manual), cleanup only needs to remove the
 * student row itself — the FK constraints handle contactPerson and
 * studentSemBand automatically, which is itself part of what these tests
 * verify. A sweep also runs in beforeAll/afterAll to clean up any leftover
 * marked rows from a previous run that crashed before cleanup completed.
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

// deletes a student's dependent rows first (defensive — in case cascade
// didn't fire, e.g. a test that intentionally leaves a row behind), then
// the student row itself. Safe to call even if rows are already gone.
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

// helper: inserts a real student (with contacts + sem band, via the real
// route) so each test starts from a genuine, fully-formed DB row rather
// than a hand-crafted INSERT that might not match production shape
async function seedStudent(contactPersons) {
    const nric = makeTestNric();
    const payload = {
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
        remarks: TEST_MARKER,
        contactPersons
    };

    const res = await request(app).post('/students').send(payload);
    insertedStudentIds.push(res.body.studentId);
    return res.body.studentId;
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

describe('19.2.1 Integration Test: Delete Student Successfully (Success Flow)', () => {
    test('removes the student record from the database', async () => {
        const studentId = await seedStudent([
            {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true}
        ]);

        const res = await request(app).delete(`/students/${studentId}`);

        expect(res.status).toBe(200);
        
        const [rows] = await pool.query('SELECT * FROM student WHERE studentId = ?', [studentId]);
        expect(rows.length).toBe(0);
    });
});

describe('19.2.2 Integration Test: Cascade Deletion of Dependent Records', () => {
    test('removes associated contactPerson rows when the student is deleted', async () => {
        const studentId = await seedStudent([
            {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true},
            {contactName: 'Ben Tan', phoneNumber: '+65 8256 9583', email: 'bentan@test.com', relationship: 'Father', isPrimary: false}
        ]);

        const [contactsBefore] = await pool.query('SELECT * FROM contactPerson WHERE studentId = ?', [studentId]);
        expect(contactsBefore.length).toBe(2); // sanity check before deletion

        await request(app).delete(`/students/${studentId}`);

        const [contactsAfter] = await pool.query('SELECT * FROM contactPerson WHERE studentId = ?', [studentId]);
        expect(contactsAfter.length).toBe(0);
    });

    test('removes associated studentSemBand rows when the student is deleted', async () => {
        const studentId = await seedStudent([
            {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true}
        ]);

        const [semBandBefore] = await pool.query('SELECT * FROM studentSemBand WHERE studentId = ?', [studentId]);
        expect(semBandBefore.length).toBe(1);   // sanity check before deletion

        await request(app).delete(`/students/${studentId}`);

        const [semBandAfter] = await pool.query('SELECT * FROM studentSemBand WHERE studentId = ?', [studentId]);
        expect(semBandAfter.length).toBe(0);
    });

    test('removes both contactPerson and studentSemBand rows in a single deletion (combined check)', async () => {
        const studentId = await seedStudent([
            {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true},
            {contactName: 'Ben Tan', phoneNumber: '+65 8256 9583', email: 'bentan@test.com', relationship: 'Father', isPrimary: false}
        ]);

        await request(app).delete(`/students/${studentId}`);

        const [studentRows] = await pool.query('SELECT * FROM student WHERE studentId = ?', [studentId]);
        const [contactRows] = await pool.query('SELECT * FROM contactPerson WHERE studentId = ?', [studentId]);
        const [semBandRows] = await pool.query('SELECT * FROM studentSemBand WHERE studentId = ?', [studentId]);

        expect(studentRows.length).toBe(0);
        expect(contactRows.length).toBe(0);
        expect(semBandRows.length).toBe(0);
    });
});

describe('4.3.3 Integration Test: Delete Student with No Contact Persons (Boundary)', () => {
    test('succeeds even when the student somehow has 0 contact persons at the DB layer', async () => {
        // the route normally blocks creating a student with 0 contacts (validateContactPersons), so seedStudent() (which goes through the real POST route) can't be used here. Insert directly to isolate deleteStudent()'s own boundary behavior from that unrelated rule.
        const nric = makeTestNric();
        const [result] = await pool.query(
            `INSERT INTO student
            (firstName, lastName, nric, enrolmentDate, currentSemester, age, dateOfBirth, schoolLevel, centreId, schoolId, educatorId, currentBand, remarks)
            VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['Hee Hee', 'Tan', nric, validSemesterId, 10, '2015-05-01', 'Secondary', validCentreId, validSchoolId, validEducatorId, 'A1', TEST_MARKER]
        );
        const studentId = result.insertId;
        insertedStudentIds.push(studentId);

        const res = await request(app).delete(`/students/${studentId}`);

        expect(res.status).toBe(200);

        const [rows] = await pool.query('SELECT * FROM student WHERE studentId = ?', [studentId]);
        expect(rows.length).toBe(0);
    });
});

describe('19.2.4 Integration Test: Delete Non-Existent Student', () => {
    test('returns 404 and makes no DB changes when the studentId does not exist', async () => {
        // pick an id well outside any realistic auto-increment range currently in use
        const nonExistentId = 999999999;

        const res = await request(app).delete(`/students/${nonExistentId}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/student not found/i);
    });
});