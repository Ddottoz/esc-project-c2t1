const {
    RUN_ID,
    BAND_NAMES,
    pool,
    bandIdFor,
    createAuthenticatedAgent,
    removeAuthFixture,
    sweepMarkedEducators,
    insertBand,
    cleanupBand,
    sweepMarkedBands,
    createStudent,
    cleanupStudent,
    sweepMarkedStudents
} = require('./bandIntegrationHelpers');
const bandModel = require('../../../models/band');

jest.setTimeout(30000);

let agent;
const bandIds = new Set();
const studentIds = new Set();

function codeFor(name) {
    return name.replace('Band ', '');
}

async function unusedTransition(movement) {
    const [semesters] = await pool.query(`
        SELECT MIN(semesterId) AS semesterId, academicYear, semesterNo
        FROM semester WHERE academicYear BETWEEN 2026 AND 2035
        GROUP BY academicYear, semesterNo
        ORDER BY academicYear, semesterNo
    `);
    const [assessed] = await pool.query('SELECT band, COUNT(*) AS count FROM assessment GROUP BY band');
    const assessedCodes = new Set(assessed.filter((row) => Number(row.count) > 0).map((row) => row.band));
    const [usedRows] = await pool.query(`
        SELECT sb.semesterBandId, sb.band, s.academicYear, s.semesterNo
        FROM semesterBand sb INNER JOIN semester s ON s.semesterId = sb.semesterId
    `);
    const used = new Set(usedRows.map((row) => `${row.academicYear}:${row.semesterNo}:${row.band}`));
    const usedIds = new Set(usedRows.map((row) => row.semesterBandId));
    const delta = movement === 'Advance' ? 1 : movement === 'Lower' ? -1 : 0;
    for (let targetIndex = 0; targetIndex < BAND_NAMES.length; targetIndex++) {
        const priorIndex = targetIndex - delta;
        if (priorIndex < 0 || priorIndex >= BAND_NAMES.length) continue;
        const priorName = BAND_NAMES[priorIndex];
        const targetName = BAND_NAMES[targetIndex];
        const priorCode = codeFor(priorName);
        const targetCode = codeFor(targetName);
        if (!assessedCodes.has(priorCode) || !assessedCodes.has(targetCode)) continue;
        for (let index = 0; index < semesters.length - 1; index++) {
            const oldTerm = semesters[index];
            const newTerm = semesters[index + 1];
            const priorId = bandIdFor(priorName, oldTerm.academicYear, `Semester ${oldTerm.semesterNo}`);
            const targetId = bandIdFor(targetName, newTerm.academicYear, `Semester ${newTerm.semesterNo}`);
            if (used.has(`${oldTerm.academicYear}:${oldTerm.semesterNo}:${priorCode}`) ||
                used.has(`${newTerm.academicYear}:${newTerm.semesterNo}:${targetCode}`) ||
                usedIds.has(priorId) || usedIds.has(targetId)) continue;
            return {
                prior: {
                    name: priorName, code: priorCode, semesterId: oldTerm.semesterId,
                    year: Number(oldTerm.academicYear), semester: `Semester ${oldTerm.semesterNo}`,
                    id: priorId
                },
                target: {
                    name: targetName, code: targetCode, semesterId: newTerm.semesterId,
                    year: Number(newTerm.academicYear), semester: `Semester ${newTerm.semesterNo}`,
                    id: targetId
                }
            };
        }
    }
    throw new Error(`No unused assessed transition is available for ${movement}`);
}

async function seedCandidate(movement, {failed = false} = {}) {
    const fixture = await unusedTransition(movement);
    await insertBand(fixture.prior, `${RUN_ID} prior ${movement}`);
    await insertBand(fixture.target, `${RUN_ID} target ${movement}`);
    bandIds.add(fixture.prior.id);
    bandIds.add(fixture.target.id);
    const studentId = await createStudent(fixture.prior, {lastName: movement});
    studentIds.add(studentId);
    await pool.query(
        'INSERT INTO studentSemBand (semesterId, studentId, band, movement) VALUES (?, ?, ?, ?)',
        [fixture.prior.semesterId, studentId, fixture.prior.code, 'Continue']
    );
    const [assessments] = await pool.query(
        'SELECT assessmentId, totalMark, passingMark FROM assessment WHERE band = ? ORDER BY assessmentId',
        [fixture.prior.code]
    );
    const validAssessments = assessments.filter((item) => Number(item.totalMark) > 0);
    const failedIndex = assessments.findIndex((item) => Number(item.passingMark) > 0);
    const baseWeight = validAssessments.length ? Math.floor(10000 / validAssessments.length) / 100 : 0;
    let assignedWeight = 0;
    for (const [index, assessment] of assessments.entries()) {
        const validPoints = Number(assessment.totalMark) > 0;
        const isLastValid = assessment === validAssessments.at(-1);
        const score = failed && index === failedIndex
            ? Number(assessment.passingMark) - 1
            : validPoints ? Number(assessment.totalMark) : Number(assessment.passingMark);
        const weight = validPoints ? (isLastValid ? 100 - assignedWeight : baseWeight) : 0;
        await pool.query(`
            INSERT INTO semesterBandAssessmentWeight (semesterBandId, assessmentId, weight)
            VALUES (?, ?, ?)
        `, [fixture.prior.id, assessment.assessmentId, weight]);
        if (validPoints) assignedWeight += weight;
        await pool.query(`
            INSERT INTO studentAssessment (studentId, assessmentId, semesterId, score, status, dueDate)
            VALUES (?, ?, ?, ?, 'Graded', CURDATE())
        `, [studentId, assessment.assessmentId, fixture.prior.semesterId, score]);
    }
    const priorBand = await bandModel.getBand(fixture.prior.id);
    const priorDashboard = bandModel.getStudentDashboard(priorBand, studentId);
    expect(priorDashboard).not.toBeNull();
    expect(priorDashboard.passed).toBe(!failed);
    return {...fixture, studentId};
}

beforeAll(async () => {
    await sweepMarkedStudents();
    await sweepMarkedBands();
    await sweepMarkedEducators();
    agent = await createAuthenticatedAgent();
});

afterEach(async () => {
    for (const id of studentIds) await cleanupStudent(id);
    studentIds.clear();
    for (const id of bandIds) await cleanupBand(id);
    bandIds.clear();
});

afterAll(async () => {
    await sweepMarkedStudents();
    await sweepMarkedBands();
    await removeAuthFixture();
    await pool.end();
});

describe('UC15 enrollment integration', () => {
    test('15.2.1 lists a passing student for Advance', async () => {
        const fixture = await seedCandidate('Advance');
        const response = await agent.get(`/bands/${fixture.target.id}/enrollment`);
        expect(response.status).toBe(200);
        expect(response.text).toContain(`value="${fixture.studentId}"`);
        expect(response.text).toContain('data-movement="Advance"');
    });

    test('15.2.2 excludes a failed student from Advance', async () => {
        const fixture = await seedCandidate('Advance', {failed: true});
        const response = await agent.get(`/bands/${fixture.target.id}/enrollment`);
        expect(response.status).toBe(200);
        expect(response.text).not.toContain(`value="${fixture.studentId}"`);
    });

    test('15.2.3 adds an eligible student and creates assignments', async () => {
        const fixture = await seedCandidate('Advance');
        const response = await agent.post(`/bands/${fixture.target.id}/enrollment`).type('form').send({
            studentId: fixture.studentId,
            movement: 'Advance'
        });
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`/bands/${fixture.target.id}/enrollment`);
        const [[enrollment]] = await pool.query(
            'SELECT movement FROM studentSemBand WHERE semesterId = ? AND studentId = ?',
            [fixture.target.semesterId, fixture.studentId]
        );
        expect(enrollment.movement).toBe('Advance');
        const [[{count}]] = await pool.query(
            'SELECT COUNT(*) AS count FROM studentAssessment WHERE studentId = ? AND semesterId = ?',
            [fixture.studentId, fixture.target.semesterId]
        );
        const [[{expected}]] = await pool.query(
            'SELECT COUNT(*) AS expected FROM assessment WHERE band = ?', [fixture.target.code]
        );
        expect(Number(count)).toBe(Number(expected));
    });

    test('15.2.4 rejects a tampered movement without mutation', async () => {
        const fixture = await seedCandidate('Advance');
        const response = await agent.post(`/bands/${fixture.target.id}/enrollment`).type('form').send({
            studentId: fixture.studentId,
            movement: 'Continue'
        });
        expect(response.status).toBe(302);
        expect(decodeURIComponent(response.headers.location)).toContain('not eligible');
        const [[{count}]] = await pool.query(
            'SELECT COUNT(*) AS count FROM studentSemBand WHERE semesterId = ? AND studentId = ?',
            [fixture.target.semesterId, fixture.studentId]
        );
        expect(Number(count)).toBe(0);
    });

    test('15.2.5 rejects a duplicate semester enrollment', async () => {
        const fixture = await seedCandidate('Advance');
        const [occupied] = await pool.query(
            'SELECT band FROM semesterBand WHERE semesterId = ?', [fixture.target.semesterId]
        );
        const occupiedCodes = new Set(occupied.map((row) => row.band));
        const otherName = BAND_NAMES.find((name) => {
            const code = codeFor(name);
            return code !== fixture.target.code && !occupiedCodes.has(code);
        });
        if (!otherName) throw new Error('No second Band is available for duplicate-enrollment fixture');
        const otherCode = codeFor(otherName);
        const otherTerm = {
            ...fixture.target,
            name: otherName,
            code: otherCode,
            id: bandIdFor(otherName, fixture.target.year, fixture.target.semester)
        };
        await insertBand(otherTerm, `${RUN_ID} duplicate enrollment`);
        bandIds.add(otherTerm.id);
        await pool.query(
            'INSERT INTO studentSemBand (semesterId, studentId, band, movement) VALUES (?, ?, ?, ?)',
            [fixture.target.semesterId, fixture.studentId, otherCode, 'Continue']
        );
        const response = await agent.post(`/bands/${fixture.target.id}/enrollment`).type('form').send({
            studentId: fixture.studentId, movement: 'Advance'
        });
        expect(response.status).toBe(302);
        expect(decodeURIComponent(response.headers.location)).toContain('already enrolled');
        const [[{count}]] = await pool.query(
            'SELECT COUNT(*) AS count FROM studentSemBand WHERE semesterId = ? AND studentId = ?',
            [fixture.target.semesterId, fixture.studentId]
        );
        expect(Number(count)).toBe(1);
    });

    test('15.2.6 removes an enrollment and its assignments', async () => {
        const fixture = await seedCandidate('Advance');
        await agent.post(`/bands/${fixture.target.id}/enrollment`).type('form').send({
            studentId: fixture.studentId, movement: 'Advance'
        });
        const [[assignment]] = await pool.query(
            'SELECT studentAssessmentId FROM studentAssessment WHERE semesterId = ? AND studentId = ? ORDER BY studentAssessmentId LIMIT 1',
            [fixture.target.semesterId, fixture.studentId]
        );
        const [[studentBefore]] = await pool.query(
            'SELECT educatorId, currentSemester, currentBand FROM student WHERE studentId = ?',
            [fixture.studentId]
        );
        expect(studentBefore.currentSemester).toBe(fixture.target.semesterId);
        expect(studentBefore.currentBand).toBe(fixture.target.code);
        await pool.query(`
            INSERT INTO assessmentSubmission
                (studentAssessmentId, submittedDate, submittedBy, filepath, score, analysis, isAccepted, reviewedBy)
            VALUES (?, CURDATE(), ?, ?, 100, ?, 1, ?)
        `, [
            assignment.studentAssessmentId,
            studentBefore.educatorId,
            `/uploads/${RUN_ID}-enrollment.pdf`,
            `${RUN_ID} submission`,
            studentBefore.educatorId
        ]);
        await pool.query(
            'INSERT INTO assessment_analysis (submissionId, diagnosticSummary, isAccepted) VALUES (?, ?, 1)',
            [assignment.studentAssessmentId, `${RUN_ID} analysis`]
        );
        const response = await agent.post(`/bands/${fixture.target.id}/enrollment/${fixture.studentId}/delete`);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`/bands/${fixture.target.id}/enrollment`);
        const [[{enrollments}]] = await pool.query(
            'SELECT COUNT(*) AS enrollments FROM studentSemBand WHERE semesterId = ? AND studentId = ?',
            [fixture.target.semesterId, fixture.studentId]
        );
        const [[{assignments}]] = await pool.query(
            'SELECT COUNT(*) AS assignments FROM studentAssessment WHERE semesterId = ? AND studentId = ?',
            [fixture.target.semesterId, fixture.studentId]
        );
        const [[{submissions}]] = await pool.query(
            'SELECT COUNT(*) AS submissions FROM assessmentSubmission WHERE studentAssessmentId = ?',
            [assignment.studentAssessmentId]
        );
        const [[{analyses}]] = await pool.query(
            'SELECT COUNT(*) AS analyses FROM assessment_analysis WHERE submissionId = ?',
            [assignment.studentAssessmentId]
        );
        const [[studentAfter]] = await pool.query(
            'SELECT currentBand FROM student WHERE studentId = ?', [fixture.studentId]
        );
        const [[{history}]] = await pool.query(
            'SELECT COUNT(*) AS history FROM studentSemBand WHERE semesterId = ? AND studentId = ? AND band = ?',
            [fixture.prior.semesterId, fixture.studentId, fixture.prior.code]
        );
        expect(Number(enrollments)).toBe(0);
        expect(Number(assignments)).toBe(0);
        expect(Number(submissions)).toBe(0);
        expect(Number(analyses)).toBe(0);
        expect(studentAfter.currentBand).toBeNull();
        expect(Number(history)).toBe(1);
    });

    test('15.2.7 exports quoted UTF-8 CSV with calculated values', async () => {
        const fixture = await seedCandidate('Continue');
        await agent.post(`/bands/${fixture.target.id}/enrollment`).type('form').send({
            studentId: fixture.studentId, movement: 'Continue'
        });
        await pool.query('UPDATE student SET firstName = ?, lastName = ? WHERE studentId = ?', ['Cara, "CJ"', '中心', fixture.studentId]);
        const response = await agent.get(`/bands/${fixture.target.id}/enrollment.csv`);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/^text\/csv/);
        expect(response.headers['content-disposition']).toContain(`${fixture.target.name}-enrollment.csv`);
        expect(response.text).toContain('"Cara, ""CJ"" 中心"');
        expect(response.text).toContain('\r\n');
        expect(response.text).toContain('"0%","0%","0","0%"');
    });

    test.each(['get', 'post'])('15.2.8 returns 404 for a missing Band on %s', async (method) => {
        const response = method === 'get'
            ? await agent.get('/bands/does-not-exist/enrollment')
            : await agent.post('/bands/does-not-exist/enrollment').type('form').send({});
        expect(response.status).toBe(404);
        expect(response.text).toContain('Band not found');
    });

    test('15.2.9 preserves state when removing a nonexistent enrollment', async () => {
        const fixture = await seedCandidate('Continue');
        const response = await agent.post(`/bands/${fixture.target.id}/enrollment/${fixture.studentId}/delete`);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`/bands/${fixture.target.id}/enrollment`);
        const [[{count}]] = await pool.query(
            'SELECT COUNT(*) AS count FROM studentSemBand WHERE studentId = ?', [fixture.studentId]
        );
        expect(Number(count)).toBe(1);
    });

    test.each([
        ['15.2.10', 'Continue'],
        ['15.2.11', 'Lower']
    ])('%s lists and commits %s movement', async (_caseId, movement) => {
        const fixture = await seedCandidate(movement);
        const listed = await agent.get(`/bands/${fixture.target.id}/enrollment`);
        expect(listed.status).toBe(200);
        expect(listed.text).toContain(`data-movement="${movement}"`);
        const response = await agent.post(`/bands/${fixture.target.id}/enrollment`).type('form').send({
            studentId: fixture.studentId, movement
        });
        expect(response.status).toBe(302);
        const [[row]] = await pool.query(
            'SELECT movement FROM studentSemBand WHERE semesterId = ? AND studentId = ?',
            [fixture.target.semesterId, fixture.studentId]
        );
        expect(row.movement).toBe(movement);
    });
});
