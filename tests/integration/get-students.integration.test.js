/**
 * Integration tests for Get All Students (GET /students).
 * No mocks — hits a real Express app instance backed by the real MySQL
 * database (via the pool from models/db.js). Verifies that the route,
 * model, and DB joins (student + centre + school + educator + batched
 * contactPerson lookup) all work correctly together, including the
 * getAllStudents() call this relies on for UC10 (Select Student).
 *
 * SAFETY: every test row is marked via a fixed string in `remarks`, and
 * every inserted studentId is tracked for cleanup — contactPerson and
 * studentSemBand rows are deleted before the student row itself (no
 * ON DELETE CASCADE assumed in cleanup, even though it's confirmed to
 * exist — cleanup stays defensive regardless). A sweep also runs in
 * beforeAll/afterAll to clean up any leftover marked rows from a
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

// helper: inserts a real student (with contacts + sem band, via the real route) so each test starts from a genuine, fully-formed DB row
async function seedStudent(contactPersons, overrides = {}) {
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
        contactPersons,
        ...overrides
    };

    const res = await request(app).post('/students').send(payload);
    insertedStudentIds.push(res.body.studentId);
    return {studentId: res.body.studentId, nric};
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

describe('10.2.1 Integration Test: Get All Students Successfully', () => {
    test('returns a seeded student with their contact persons attached', async () => {
        const {studentId} = await seedStudent([
            {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true}
        ]);

        const res = await request(app).get('/students');

        expect(res.status).toBe(200);
        const seeded = res.body.find((s) => s.studentId === studentId);
        expect(seeded).toBeDefined();
        expect(seeded.firstName).toBe('Hee Hee');
        expect(seeded.contactPersons.length).toBe(1);
        expect(seeded.contactPersons[0].contactName).toBe('Lim Lee Hui');
        expect(seeded.contactPersons[0].isPrimary).toBe(true);
    });

    test('returns multiple seeded students, each with their own correctly-attached contacts', async () => {
        const student1 = await seedStudent([
            {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true}
        ]);
        const student2 = await seedStudent([
            {contactName: 'David Lim', phoneNumber: '+65 9182 3456', email: 'davidlim@test.com', relationship: 'Father', isPrimary: true},
            {contactName: 'Susan Lim', phoneNumber: '+65 8123 7890', email: 'susanlim@test.com', relationship: 'Mother', isPrimary: false}
        ]);

        const res = await request(app).get('/students');

        expect(res.status).toBe(200);
        const seeded1 = res.body.find((s) => s.studentId === student1.studentId);
        const seeded2 = res.body.find((s) => s.studentId === student2.studentId);

        expect(seeded1.contactPersons.length).toBe(1);
        expect(seeded2.contactPersons.length).toBe(2);
        // confirms the batched contact-fetch groups by the correct studentId, not just returning all contacts to everyone
        expect(seeded2.contactPersons.map((c) => c.contactName).sort()).toEqual(['David Lim', 'Susan Lim']);
    });

    test('includes joined centre, school and educator names, not just their ids', async () => {
        const {studentId} = await seedStudent([
            {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true}
        ]);

        const res = await request(app).get('/students');

        const seeded = res.body.find((s) => s.studentId === studentId);
        expect(seeded.centreName).toBeDefined();
        expect(seeded.schoolName).toBeDefined();
        expect(seeded.educatorName).toBeDefined();
    });
});

describe('10.2.2 Integration Test: Get All Students with No Matching Data (Boundary)', () => {
    test('returns an empty array shape correctly when no marked test students exist', async () => {
        // no seeding in this test — verifies the route/model do not error out on a dataset that could be empty, and that the response is always an array (never null/undefined), regardless of how many real students already exist in the shared dev/test database
        const res = await request(app).get('/students');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

describe('9.2.5 Integration Test: Get Student By ID Successfully', () => {
    test('returns a single seeded student with joined names and contacts', async () => {
        const {studentId} = await seedStudent([
            {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true}
        ]);

        const res = await request(app).get(`/students/${studentId}`);

        expect(res.status).toBe(200);
        expect(res.body.studentId).toBe(studentId);
        expect(res.body.centreName).toBeDefined();
        expect(res.body.contactPersons.length).toBe(1);
    });

    test('returns 404 for a non-existent studentId', async () => {
        const res = await request(app).get('/students/999999999');
        expect(res.status).toBe(404);
    });
});

describe('10.2.3 Integration/Robustness Test: XSS Payload Survives Round-Trip Safely', () => {
    test('a malicious firstName stored in the database is returned as-is by the API (escaping is the frontend\'s responsibility, not the API\'s)', async () => {
        const payload = '<img src=x onerror=alert(1)>';
        const {studentId} = await seedStudent(
            [{contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true}],
            {firstName: payload}
        );

        const res = await request(app).get('/students');

        const seeded = res.body.find((s) => s.studentId === studentId);
        // the API itself does NOT escape — it returns raw data (correct: escaping is a rendering-layer concern, not an API-layer one). This test documents that the payload survives the full DB round-trip unmodified, which is exactly why renderRows()'s own escapeHtml() call is the critical defense — verified separately in students-list.test.js.
        expect(seeded.firstName).toBe(payload);
    });
});