const {
    RUN_ID,
    BAND_NAMES,
    pool,
    createAuthenticatedAgent,
    removeAuthFixture,
    sweepMarkedEducators,
    findUnusedBandTerms,
    insertBand,
    cleanupBand,
    sweepMarkedBands,
    createStudent,
    cleanupStudent,
    sweepMarkedStudents
} = require('./bandIntegrationHelpers');

jest.setTimeout(30000);

let agent;
const bandIds = new Set();
const studentIds = new Set();

async function dashboardFixture(options = {}) {
    const [term] = await findUnusedBandTerms(1, {requireAssessments: true});
    await insertBand(term, `${RUN_ID} dashboard`);
    bandIds.add(term.id);
    const studentId = await createStudent(term, {lastName: 'Dashboard'});
    studentIds.add(studentId);
    await pool.query(
        'INSERT INTO studentSemBand (semesterId, studentId, band, movement) VALUES (?, ?, ?, ?)',
        [term.semesterId, studentId, term.code, 'Continue']
    );
    const [assessments] = await pool.query(
        'SELECT assessmentId, totalMark, passingMark FROM assessment WHERE band = ? ORDER BY assessmentId',
        [term.code]
    );
    const validAssessments = assessments.filter((item) => Number(item.totalMark) > 0);
    const baseWeight = validAssessments.length ? Math.floor(10000 / validAssessments.length) / 100 : 0;
    let assignedWeight = 0;
    for (const assessment of assessments) {
        const validPoints = Number(assessment.totalMark) > 0;
        const weight = validPoints
            ? assessment === validAssessments.at(-1) ? 100 - assignedWeight : baseWeight
            : 0;
        await pool.query(`
            INSERT INTO semesterBandAssessmentWeight (semesterBandId, assessmentId, weight)
            VALUES (?, ?, ?)
        `, [term.id, assessment.assessmentId, weight]);
        if (validPoints) assignedWeight += weight;
        const score = options.missing ? null
            : validPoints
                ? options.scoreFor ? options.scoreFor(assessment, assessments) : Number(assessment.totalMark)
                : Number(assessment.passingMark);
        const [result] = await pool.query(`
            INSERT INTO studentAssessment (studentId, assessmentId, semesterId, score, status, dueDate)
            VALUES (?, ?, ?, ?, ?, CURDATE())
        `, [
            studentId,
            assessment.assessmentId,
            term.semesterId,
            score,
            options.missing ? 'Missing' : options.status || 'Graded'
        ]);
        assessment.studentAssessmentId = result.insertId;
    }
    return {term, studentId, assessments};
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

describe('UC16 student Band dashboard integration', () => {
    test('16.2.1 renders a complete PASS dashboard and Review link', async () => {
        const fixture = await dashboardFixture();
        const first = fixture.assessments[0];
        await pool.query(
            'INSERT INTO assessment_analysis (submissionId, diagnosticSummary, isAccepted) VALUES (?, ?, ?)',
            [first.studentAssessmentId, `${RUN_ID} analysis`, 0]
        );
        const response = await agent.get(`/bands/${fixture.term.id}/students/${fixture.studentId}`);
        expect(response.status).toBe(200);
        expect(response.text).toContain(`${RUN_ID} Dashboard`);
        expect(response.text).toContain('100% weighted score; 90% required');
        expect(response.text).toContain('PASS');
        expect(response.text).toContain(`/assessments/${first.assessmentId}/review`);
    });

    test('16.2.2 renders missing assessments as FAIL with no Review link', async () => {
        const fixture = await dashboardFixture({missing: true});
        const response = await agent.get(`/bands/${fixture.term.id}/students/${fixture.studentId}`);
        expect(response.status).toBe(200);
        expect(response.text).toContain('FAIL');
        expect(response.text).toContain('--/');
        expect(response.text).toContain(
            `/bands/${fixture.term.id}/students/${fixture.studentId}/assessments/${fixture.assessments[0].assessmentId}/upload`
        );
        expect(response.text).not.toContain(`/assessments/${fixture.assessments[0].assessmentId}/review`);
    });

    test('16.2.3 renders two past Bands newest first', async () => {
        const fixture = await dashboardFixture();
        const [semesters] = await pool.query(`
            SELECT semesterId, academicYear, semesterNo
            FROM semester
            WHERE (academicYear * 2 + semesterNo) < ?
            ORDER BY academicYear DESC, semesterNo DESC
        `, [fixture.term.year * 2 + Number(fixture.term.semester.match(/[12]$/)[0])]);
        const [usedRows] = await pool.query('SELECT semesterId, band FROM semesterBand');
        const used = new Set(usedRows.map((row) => `${row.semesterId}:${row.band}`));
        const history = [];
        for (const semester of semesters) {
            const name = BAND_NAMES.find((candidate) => {
                const code = candidate.replace('Band ', '');
                return !used.has(`${semester.semesterId}:${code}`);
            });
            if (!name) continue;
            const code = name.replace('Band ', '');
            const term = {
                name, code, semesterId: semester.semesterId,
                year: Number(semester.academicYear), semester: `Semester ${semester.semesterNo}`,
                id: `band-${code.toLowerCase()}-${semester.academicYear}-s${semester.semesterNo}`
            };
            await insertBand(term, `${RUN_ID} history ${history.length}`);
            bandIds.add(term.id);
            await pool.query(
                'INSERT INTO studentSemBand (semesterId, studentId, band, movement) VALUES (?, ?, ?, ?)',
                [term.semesterId, fixture.studentId, term.code, 'Continue']
            );
            history.push(term);
            if (history.length === 2) break;
        }
        if (history.length < 2) throw new Error('Test database lacks two unused historical Band/term fixtures');
        const response = await agent.get(`/bands/${fixture.term.id}/students/${fixture.studentId}`);
        expect(response.status).toBe(200);
        const first = response.text.indexOf(`/bands/${history[0].id}/students/${fixture.studentId}`);
        const second = response.text.indexOf(`/bands/${history[1].id}/students/${fixture.studentId}`);
        expect(first).toBeGreaterThan(-1);
        expect(second).toBeGreaterThan(first);
    });

    test('16.2.4 returns 404 when the student is not enrolled in the Band', async () => {
        const fixture = await dashboardFixture();
        const outsider = await createStudent(fixture.term, {lastName: 'Outsider'});
        studentIds.add(outsider);
        const response = await agent.get(`/bands/${fixture.term.id}/students/${outsider}`);
        expect(response.status).toBe(404);
        expect(response.text).toContain('Enrollment not found');
    });

    test('16.2.5 returns 404 for a missing Band', async () => {
        const response = await agent.get('/bands/does-not-exist/students/1');
        expect(response.status).toBe(404);
        expect(response.text).toContain('Band not found');
    });

    test('16.2.6 redirects an assigned assessment to Upload', async () => {
        const fixture = await dashboardFixture();
        const assessment = fixture.assessments[0];
        const response = await agent.get(
            `/bands/${fixture.term.id}/students/${fixture.studentId}/assessments/${assessment.assessmentId}/upload`
        );
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`/upload/${assessment.studentAssessmentId}`);
    });

    test('16.2.7 redirects an analysed assessment to Review', async () => {
        const fixture = await dashboardFixture();
        const assessment = fixture.assessments[0];
        await pool.query(
            'INSERT INTO assessment_analysis (submissionId, diagnosticSummary, isAccepted) VALUES (?, ?, ?)',
            [assessment.studentAssessmentId, RUN_ID, 0]
        );
        const response = await agent.get(
            `/bands/${fixture.term.id}/students/${fixture.studentId}/assessments/${assessment.assessmentId}/review`
        );
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`/viewanalysis/${assessment.studentAssessmentId}`);
    });

    test('16.2.8 returns 404 when Review has no analysis', async () => {
        const fixture = await dashboardFixture();
        const assessment = fixture.assessments[0];
        const response = await agent.get(
            `/bands/${fixture.term.id}/students/${fixture.studentId}/assessments/${assessment.assessmentId}/review`
        );
        expect(response.status).toBe(404);
        expect(response.text).toContain('Assessment analysis not found');
    });

    test('16.2.9 passes at the exact rounded threshold of 90', async () => {
        const fixture = await dashboardFixture({
            scoreFor: (assessment) => Number(assessment.totalMark) * 0.9
        });
        if (fixture.assessments.some((item) =>
            Number(item.totalMark) > 0 && Number(item.passingMark) > Number(item.totalMark) * 0.9
        )) {
            throw new Error('Test database lacks a Band whose rubric passing marks permit the exact-90 fixture');
        }
        const response = await agent.get(`/bands/${fixture.term.id}/students/${fixture.studentId}`);
        expect(response.status).toBe(200);
        expect(response.text).toContain('90% weighted score');
        expect(response.text).toContain('PASS');
    });

    test('16.2.10 fails at an exact weighted score of 89.99', async () => {
        const fixture = await dashboardFixture({
            scoreFor: (assessment) => Number(assessment.totalMark) * 0.8999
        });
        const response = await agent.get(`/bands/${fixture.term.id}/students/${fixture.studentId}`);
        expect(response.status).toBe(200);
        expect(response.text).toContain('89.99% weighted score');
        expect(response.text).toContain('FAIL');
    });

    test('16.2.11 fails an individual rubric despite a high total', async () => {
        const fixture = await dashboardFixture();
        const failed = fixture.assessments.find((item) =>
            Number(item.totalMark) <= 0 && Number(item.passingMark) > 0
        );
        if (!failed) throw new Error('Test database needs a zero-weight rubric with a positive passing mark for 16.2.11');
        await pool.query(
            'UPDATE studentAssessment SET score = ? WHERE studentAssessmentId = ?',
            [Math.max(0, Number(failed.passingMark) - 1), failed.studentAssessmentId]
        );
        const response = await agent.get(`/bands/${fixture.term.id}/students/${fixture.studentId}`);
        expect(response.status).toBe(200);
        expect(response.text).toContain('100% weighted score');
        expect(response.text).toContain('FAIL');
    });

    test('16.2.12 renders a test-owned empty-assessment Band as FAIL', async () => {
        // Every production Band currently has assessment definitions. Create a
        // test-owned lookup row instead of relying on that mutable condition.
        const code = 'T0';
        await pool.query('INSERT INTO band (band) VALUES (?)', [code]);
        try {
            const [base] = await findUnusedBandTerms(1, {name: `Band ${code}`});
            await insertBand(base, `${RUN_ID} empty assessments`);
            bandIds.add(base.id);
            const studentId = await createStudent(base);
            studentIds.add(studentId);
            await pool.query(
                'INSERT INTO studentSemBand (semesterId, studentId, band, movement) VALUES (?, ?, ?, ?)',
                [base.semesterId, studentId, base.code, 'Continue']
            );
            const response = await agent.get(`/bands/${base.id}/students/${studentId}`);
            expect(response.status).toBe(200);
            expect(response.text).toContain('0% weighted score');
            expect(response.text).toContain('FAIL');
        } finally {
            for (const studentId of studentIds) await cleanupStudent(studentId);
            studentIds.clear();
            for (const bandId of bandIds) await cleanupBand(bandId);
            bandIds.clear();
            await pool.query('DELETE FROM band WHERE band = ?', [code]);
        }
    });

    test('16.2.13 rejects an assessment belonging to another Band', async () => {
        const fixture = await dashboardFixture();
        const [[other]] = await pool.query('SELECT assessmentId FROM assessment WHERE band <> ? LIMIT 1', [fixture.term.code]);
        if (!other) throw new Error('Test database needs an assessment belonging to another Band');
        const response = await agent.get(
            `/bands/${fixture.term.id}/students/${fixture.studentId}/assessments/${other.assessmentId}/upload`
        );
        expect(response.status).toBe(404);
        expect(response.text).toContain('Student assessment not found');
    });

    test('16.2.14 rejects an unsupported assessment action', async () => {
        const fixture = await dashboardFixture();
        const assessment = fixture.assessments[0];
        const response = await agent.get(
            `/bands/${fixture.term.id}/students/${fixture.studentId}/assessments/${assessment.assessmentId}/download`
        );
        expect(response.status).toBe(404);
        expect(response.text).toContain('Assessment analysis not found');
    });
});
