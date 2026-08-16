const request = require('supertest');
const {randomUUID} = require('crypto');
// app.js eagerly imports the unrelated report AI service. These suites never
// call it, but the SDK requires a non-empty key while the module is loaded.
process.env.OPENAI_API_KEY ||= 'integration-test-placeholder-not-used';
const app = require('../../../app');
const pool = require('../../../models/db');
const educatorModel = require('../../../models/educator');

if (!/test/i.test(process.env.DB_NAME || '')) {
    throw new Error('UC13-16 integration tests require a database name containing "test".');
}

const MARKER_PREFIX = 'UC1316_TEST_';
// The random suffix prevents two Jest invocations from sweeping or reusing
// each other's fixtures when a local run and a CI run overlap.
const RUN_ID = `${MARKER_PREFIX}${process.pid}_${Date.now()}_${randomUUID().slice(0, 8)}`;
const PASSWORD = 'Integration-Test-Only-Password-1!';
const BAND_NAMES = [
    'Band A1', 'Band A2', 'Band A3',
    'Band B4', 'Band B5', 'Band B6',
    'Band C7', 'Band C8', 'Band C9'
];

let educatorId;

function codeFor(name) {
    return name.replace(/^Band\s+/i, '').toUpperCase();
}

function bandIdFor(name, year, semester) {
    const semesterNumber = Number(String(semester).match(/[12]$/)?.[0]);
    return `band-${codeFor(name).toLowerCase()}-${year}-s${semesterNumber}`;
}

async function createAuthenticatedAgent() {
    const email = `${RUN_ID.toLowerCase()}@example.test`;
    educatorId = await educatorModel.createEducator(`${RUN_ID} Educator`, email, PASSWORD);
    const agent = request.agent(app);
    const response = await agent.post('/login').type('form').send({email, password: PASSWORD});
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/bands');
    return agent;
}

async function removeAuthFixture() {
    if (!educatorId) return;
    await pool.query('DELETE FROM educator WHERE educatorId = ?', [educatorId]);
    educatorId = undefined;
}

async function sweepMarkedEducators() {
    await pool.query(`
        DELETE e FROM educator e
        WHERE e.email LIKE ?
          AND NOT EXISTS (SELECT 1 FROM student s WHERE s.educatorId = e.educatorId)
    `, [`${MARKER_PREFIX.toLowerCase()}%`]);
}

async function findUnusedBandTerms(count = 1, options = {}) {
    const {sameBand = false, requireAssessments = false, exclude = [], name: requiredName} = options;
    const [semesters] = await pool.query(`
        SELECT semesterId, academicYear, semesterNo
        FROM semester
        WHERE academicYear BETWEEN 2026 AND 2035 AND semesterNo IN (1, 2)
        ORDER BY academicYear DESC, semesterNo DESC
    `);
    const [usedRows] = await pool.query(`
        SELECT sb.semesterBandId, sb.semesterId, sb.band, s.academicYear, s.semesterNo
        FROM semesterBand sb INNER JOIN semester s ON s.semesterId = sb.semesterId
    `);
    const used = new Set(usedRows.map((row) => `${row.academicYear}:${row.semesterNo}:${row.band}`));
    const usedIds = new Set(usedRows.map((row) => row.semesterBandId));
    const excluded = new Set(exclude.map((item) => `${item.semesterId}:${item.code}`));
    let names = requiredName ? [requiredName] : BAND_NAMES;
    if (requireAssessments) {
        const [rows] = await pool.query('SELECT DISTINCT band FROM assessment');
        const assessed = new Set(rows.map((row) => row.band));
        names = names.filter((name) => assessed.has(codeFor(name)));
    }
    for (const name of names) {
        const found = [];
        for (const semester of semesters) {
            const code = codeFor(name);
            const key = `${semester.academicYear}:${semester.semesterNo}:${code}`;
            const id = bandIdFor(name, semester.academicYear, `Semester ${semester.semesterNo}`);
            if (!used.has(key) && !usedIds.has(id) && !excluded.has(key)) {
                found.push({
                    name,
                    code,
                    semesterId: semester.semesterId,
                    year: Number(semester.academicYear),
                    semester: `Semester ${semester.semesterNo}`,
                    id
                });
                if (!sameBand && found.length === count) return found;
            }
        }
        if (sameBand && found.length >= count) return found.slice(0, count);
    }
    throw new Error(`Test database has fewer than ${count} suitable unused Band/term combinations`);
}

async function insertBand(term, description = RUN_ID) {
    await pool.query(
        'INSERT INTO semesterBand (semesterBandId, semesterId, band, description) VALUES (?, ?, ?, ?)',
        [term.id, term.semesterId, term.code, description]
    );
    return term;
}

async function cleanupBand(id) {
    if (!id) return;
    const [[band]] = await pool.query(
        'SELECT semesterId, band FROM semesterBand WHERE semesterBandId = ?',
        [id]
    );
    if (!band) return;
    const [enrollments] = await pool.query(
        'SELECT studentId FROM studentSemBand WHERE semesterId = ? AND band = ?',
        [band.semesterId, band.band]
    );
    const studentIds = enrollments.map((row) => row.studentId);
    if (studentIds.length) {
        const [assignments] = await pool.query(`
            SELECT sa.studentAssessmentId
            FROM studentAssessment sa
            INNER JOIN assessment a ON a.assessmentId = sa.assessmentId
            WHERE sa.semesterId = ? AND a.band = ? AND sa.studentId IN (?)
        `, [band.semesterId, band.band, studentIds]);
        const assignmentIds = assignments.map((row) => row.studentAssessmentId);
        if (assignmentIds.length) {
            await pool.query('DELETE FROM assessment_analysis_error WHERE submissionId IN (?)', [assignmentIds]);
            await pool.query('DELETE FROM assessment_analysis WHERE submissionId IN (?)', [assignmentIds]);
            await pool.query('DELETE FROM assessmentSubmission WHERE studentAssessmentId IN (?)', [assignmentIds]);
            await pool.query('DELETE FROM studentAssessment WHERE studentAssessmentId IN (?)', [assignmentIds]);
        }
        await pool.query('DELETE FROM studentSemBand WHERE semesterId = ? AND band = ?', [band.semesterId, band.band]);
    }
    await pool.query('DELETE FROM semesterBand WHERE semesterBandId = ?', [id]);
}

async function sweepMarkedBands() {
    const [rows] = await pool.query(
        'SELECT semesterBandId FROM semesterBand WHERE description LIKE ?',
        [`${MARKER_PREFIX}%`]
    );
    for (const row of rows) await cleanupBand(row.semesterBandId);
}

async function settingsBody(term, overrides = {}) {
    const [assessments] = await pool.query(
        'SELECT assessmentId FROM assessment WHERE band = ? ORDER BY assessmentId',
        [term.code]
    );
    const body = {
        year: term.year,
        semester: term.semester,
        description: `${RUN_ID} settings`,
        educatorName: [`${RUN_ID} Alice`],
        educatorCentre: ['Centre 1'],
        educatorRole: ['Lead Educator']
    };
    const base = assessments.length ? Math.floor(10000 / assessments.length) / 100 : 0;
    let assigned = 0;
    assessments.forEach((assessment, index) => {
        const weight = index === assessments.length - 1 ? 100 - assigned : base;
        body[`weight_${assessment.assessmentId}`] = weight;
        assigned += weight;
    });
    return {...body, ...overrides};
}

function authEducatorId() {
    return educatorId;
}

async function referenceIds() {
    const [[centre]] = await pool.query('SELECT centreId FROM centre ORDER BY centreId LIMIT 1');
    const [[school]] = await pool.query('SELECT schoolId FROM school ORDER BY schoolId LIMIT 1');
    if (!centre || !school || !educatorId) throw new Error('Test database lacks required centre, school, or authenticated educator fixtures');
    return {centreId: centre.centreId, schoolId: school.schoolId, educatorId};
}

async function createStudent(term, overrides = {}) {
    const refs = await referenceIds();
    const unique = `${Date.now()}${Math.floor(Math.random() * 100000)}`.slice(-7);
    const [result] = await pool.query(`
        INSERT INTO student
            (firstName, lastName, nric, enrolmentDate, currentSemester, age, dateOfBirth,
             schoolLevel, centreId, schoolId, educatorId, currentBand, remarks)
        VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        overrides.firstName || RUN_ID,
        overrides.lastName || 'Student',
        overrides.nric || `T${unique}X`,
        term.semesterId,
        overrides.age || 11,
        overrides.dateOfBirth || '2015-05-01',
        overrides.schoolLevel || 'Primary',
        refs.centreId,
        refs.schoolId,
        refs.educatorId,
        overrides.currentBand === undefined ? term.code : overrides.currentBand,
        RUN_ID
    ]);
    return result.insertId;
}

async function cleanupStudent(studentId) {
    if (!studentId) return;
    const [assignments] = await pool.query(
        'SELECT studentAssessmentId FROM studentAssessment WHERE studentId = ?', [studentId]
    );
    const ids = assignments.map((row) => row.studentAssessmentId);
    if (ids.length) {
        await pool.query('DELETE FROM assessment_analysis_error WHERE submissionId IN (?)', [ids]);
        await pool.query('DELETE FROM assessment_analysis WHERE submissionId IN (?)', [ids]);
        await pool.query('DELETE FROM assessmentSubmission WHERE studentAssessmentId IN (?)', [ids]);
    }
    await pool.query('DELETE FROM studentAssessment WHERE studentId = ?', [studentId]);
    await pool.query('DELETE FROM contactPerson WHERE studentId = ?', [studentId]);
    await pool.query('DELETE FROM studentSemBand WHERE studentId = ?', [studentId]);
    await pool.query('DELETE FROM student WHERE studentId = ?', [studentId]);
}

async function sweepMarkedStudents() {
    const [rows] = await pool.query('SELECT studentId FROM student WHERE remarks LIKE ?', [`${MARKER_PREFIX}%`]);
    for (const row of rows) await cleanupStudent(row.studentId);
}

module.exports = {
    RUN_ID,
    MARKER_PREFIX,
    BAND_NAMES,
    app,
    pool,
    request,
    bandIdFor,
    createAuthenticatedAgent,
    removeAuthFixture,
    sweepMarkedEducators,
    findUnusedBandTerms,
    insertBand,
    cleanupBand,
    sweepMarkedBands,
    settingsBody,
    authEducatorId,
    createStudent,
    cleanupStudent,
    sweepMarkedStudents
};
