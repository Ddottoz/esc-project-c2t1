/**
 * Integration tests for View Student's Progress (GET /students/:studentId/progress).
 * No mocks — hits a real Express app instance backed by the real MySQL
 * database (via the pool from models/db.js). Verifies routing and the
 * actual multi-table join/assembly logic in getProgressData() all work
 * correctly together.
 *
 * Populated-progress seeding touches 4 tables: student, studentSemBand,
 * studentAssessment, and assessmentSubmission — all wired through real
 * foreign keys. `assessment` itself is shared reference data (real
 * assessment definitions already in the DB) and is only ever READ from,
 * never inserted into or deleted by this test.
 *
 * SAFETY: same marker/cleanup approach as the other integration test
 * files — every seeded row is tagged via `remarks`, tracked precisely,
 * and cleaned up in FK-safe order (assessmentSubmission ->
 * studentAssessment -> studentSemBand -> contactPerson -> student). A
 * sweep also runs in beforeAll/afterAll for any leftover marked rows
 * from a previous crashed run.
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

let validCentreId, validSchoolId, validEducatorId;
let semesterIdOld, semesterIdNew;
let realAssessmentId, realAssessmentComponent;
const insertedStudentIds = [];

async function cleanupStudent(studentId) {
    const [studentAssessments] = await pool.query('SELECT studentAssessmentId FROM studentAssessment WHERE studentId = ?', [studentId]);
    const studentAssessmentIds = studentAssessments.map((row) => row.studentAssessmentId);

    if (studentAssessmentIds.length > 0) {
        await pool.query('DELETE FROM assessmentSubmission WHERE studentAssessmentId IN (?)', [studentAssessmentIds]);
    }

    await pool.query('DELETE FROM studentAssessment WHERE studentId = ?', [studentId]);
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

async function insertBaselineStudent() {
    const nric = makeTestNric();
    const [result] = await pool.query(`
        INSERT INTO student (firstName, lastName, nric, enrolmentDate, currentSemester, age, dateOfBirth, schoolLevel, centreId, schoolId, educatorId, currentBand, remarks) VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['Hee Hee', 'Tan', nric, semesterIdNew, 20, '2015-05-01', 'Secondary', validCentreId, validSchoolId, validEducatorId, 'A2', TEST_MARKER]);
    const studentId = result.insertId;
    insertedStudentIds.push(studentId);
    return studentId;
}

beforeAll(async () => {
    const [[centre]] = await pool.query('SELECT centreId FROM centre LIMIT 1');
    const [[school]] = await pool.query('SELECT schoolId FROM school LIMIT 1');
    const [[educator]] = await pool.query('SELECT educatorId FROM educator LIMIT 1');
    const [semesters] = await pool.query('SELECT semesterId FROM semester ORDER BY semesterId DESC LIMIT 2');
    const [[assessment]] = await pool.query('SELECT assessmentId, component FROM assessment LIMIT 1');

    validCentreId = centre.centreId;
    validSchoolId = school.schoolId;
    validEducatorId = educator.educatorId;
    semesterIdNew = semesters[0].semesterId;
    semesterIdOld = semesters[1].semesterId;
    realAssessmentId = assessment.assessmentId;
    realAssessmentComponent = assessment.component;

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

describe('3.2.1 Integration Test: View Progress with Assessment Records (Success Flow)', () => {
    test('returns a populated progress report with semesters ordered most-to-least recent', async () => {
        const studentId = await insertBaselineStudent();

        // seed 2 semesters of band history
        await pool.query('INSERT INTO studentSemBand (semesterId, studentId, band) VALUES (?, ?, ?)', [semesterIdOld, studentId, 'A1']);
        await pool.query('INSERT INTO studentSemBand (semesterId, studentId, band) VALUES (?, ?, ?)', [semesterIdNew, studentId, 'A2']);

        // seed 1 graded assessment submission in the newer semester referencing a real, existing assessment definition
        const [saResult] = await pool.query('INSERT INTO studentAssessment (studentId, assessmentId, semesterId, score, status, dueDate) VALUES (?, ?, ?, ?, ?, CURDATE())', [studentId, realAssessmentId, semesterIdOld, 18, 'Graded']);
        await pool.query('INSERT INTO assessmentSubmission (studentAssessmentId, submittedDate, submittedBy, filepath, score, analysis, isAccepted, reviewedBy) VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?)', [saResult.insertId, validEducatorId, '/uploads/test-submission.pdf', 18, 'Integration test remark', 1, validEducatorId]);

        const res = await request(app).get(`/students/${studentId}/progress`);

        expect(res.status).toBe(200);
        expect(res.body.firstName).toBe('Hee Hee');
        expect(res.body.currentBand).toBe('A2');
        expect(res.body.semesters).toHaveLength(2);
        
        // most recent semester 1st - currently in progress, no assessment submissions recorded yet
        expect(res.body.semesters[0].semesterId).toBe(semesterIdNew);
        expect(res.body.semesters[0].band).toBe('A2');
        expect(res.body.semesters[0].components).toHaveLength(0);

        // older, completed semester has the graded submission
        expect(res.body.semesters[1].semesterId).toBe(semesterIdOld);
        expect(res.body.semesters[1].band).toBe('A1');
        expect(res.body.semesters[1].components).toHaveLength(1);
        expect(res.body.semesters[1].components[0].componentName).toBe(realAssessmentComponent);
        expect(res.body.semesters[1].components[0].band).toBe('A1');
        // component band = semester band, not assessment's own band
        expect(res.body.semesters[1].components[0].remarks).toBe('Integration test remark');
    });
});

describe('3.2.2 Integration Test: View Progress with No Assessment Records (Empty State)', () => {
    test('returns a empty semesters array for a student with no submissions or semester bands', async () => {
        const studentId = await insertBaselineStudent();
        // no studentSemBand/studentAssessment rows seeded for this student
        const res = await request(app).get(`/students/${studentId}/progress`);

        expect(res.status).toBe(200);
        expect(res.body.semesters).toEqual([]);
    });

    test('returns 404 for a studentId that does not exist', async () => {
        const nonExistentId = 999999999;

        const res = await request(app).get(`/students/${nonExistentId}/progress`);

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/student not found/i);
    });
});