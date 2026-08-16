const {
    RUN_ID,
    pool,
    createAuthenticatedAgent,
    removeAuthFixture,
    sweepMarkedEducators,
    findUnusedBandTerms,
    insertBand,
    cleanupBand,
    sweepMarkedBands,
    settingsBody,
    createStudent,
    cleanupStudent,
    sweepMarkedStudents
} = require('./bandIntegrationHelpers');

jest.setTimeout(30000);

let agent;
const ids = new Set();
const studentIds = new Set();

beforeAll(async () => {
    await sweepMarkedStudents();
    await sweepMarkedBands();
    await sweepMarkedEducators();
    agent = await createAuthenticatedAgent();
});

afterEach(async () => {
    for (const id of studentIds) await cleanupStudent(id);
    studentIds.clear();
    for (const id of ids) await cleanupBand(id);
    ids.clear();
});

afterAll(async () => {
    await sweepMarkedStudents();
    await sweepMarkedBands();
    await removeAuthFixture();
    await pool.end();
});

async function seededAssessedBand() {
    const [term] = await findUnusedBandTerms(1, {requireAssessments: true});
    await insertBand(term, `${RUN_ID} original`);
    ids.add(term.id);
    return term;
}

async function readSettingsState(id) {
    const [[band]] = await pool.query(
        'SELECT semesterId, description FROM semesterBand WHERE semesterBandId = ?', [id]
    );
    const [weights] = await pool.query(
        'SELECT assessmentId, weight FROM semesterBandAssessmentWeight WHERE semesterBandId = ? ORDER BY assessmentId',
        [id]
    );
    const [educators] = await pool.query(
        'SELECT educatorName, centre, role FROM semesterBandEducator WHERE semesterBandId = ? ORDER BY semesterBandEducatorId',
        [id]
    );
    return {band, weights, educators};
}

describe('UC14 Band settings integration', () => {
    test('14.2.1 commits and renders valid weights and educators', async () => {
        const [term, destination] = await findUnusedBandTerms(2, {sameBand: true, requireAssessments: true});
        await insertBand(term, `${RUN_ID} original`);
        ids.add(term.id);
        const body = await settingsBody(destination, {
            description: `${RUN_ID} updated`,
            educatorName: [`${RUN_ID} Alice`, `${RUN_ID} Bob`],
            educatorCentre: ['Centre 1', 'Centre 2'],
            educatorRole: ['Lead Educator', 'Supporting Educator']
        });
        const response = await agent.post(`/bands/${term.id}/settings`).type('form').send(body);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`/bands/${term.id}/settings?saved=1`);
        const [[band]] = await pool.query(
            'SELECT semesterId, description FROM semesterBand WHERE semesterBandId = ?', [term.id]
        );
        expect(band.semesterId).toBe(destination.semesterId);
        expect(band.description).toBe(body.description);
        const [educators] = await pool.query(
            'SELECT educatorName, centre, role FROM semesterBandEducator WHERE semesterBandId = ? ORDER BY semesterBandEducatorId',
            [term.id]
        );
        expect(educators).toEqual([
            {educatorName: `${RUN_ID} Alice`, centre: 'Centre 1', role: 'Lead Educator'},
            {educatorName: `${RUN_ID} Bob`, centre: 'Centre 2', role: 'Supporting Educator'}
        ]);
        const submittedWeights = Object.entries(body)
            .filter(([key]) => key.startsWith('weight_'))
            .map(([key, value]) => ({assessmentId: Number(key.slice(7)), weight: Number(value)}))
            .sort((a, b) => a.assessmentId - b.assessmentId);
        const [storedWeights] = await pool.query(
            'SELECT assessmentId, weight FROM semesterBandAssessmentWeight WHERE semesterBandId = ? ORDER BY assessmentId',
            [term.id]
        );
        expect(storedWeights.map((row) => ({
            assessmentId: Number(row.assessmentId), weight: Number(row.weight)
        }))).toEqual(submittedWeights);
        const rendered = await agent.get(response.headers.location);
        expect(rendered.status).toBe(200);
        expect(rendered.text).toContain('Band updated.');
        expect(rendered.text).toContain(body.description);
    });

    test('14.2.2 rejects weights totalling 110 and preserves all settings', async () => {
        const term = await seededAssessedBand();
        const valid = await settingsBody(term);
        expect((await agent.post(`/bands/${term.id}/settings`).type('form').send(valid)).status).toBe(302);
        const before = await readSettingsState(term.id);
        const weightKeys = Object.keys(valid).filter((key) => key.startsWith('weight_'));
        const invalid = {...valid, description: `${RUN_ID} must not persist`};
        invalid[weightKeys[0]] = Number(invalid[weightKeys[0]]) + 10;
        const response = await agent.post(`/bands/${term.id}/settings`).type('form').send(invalid);
        expect(response.status).toBe(302);
        expect(decodeURIComponent(response.headers.location)).toContain('add up to exactly 100%');
        expect(await readSettingsState(term.id)).toEqual(before);
    });

    test('14.2.3 rejects migration to an occupied term for the same Band', async () => {
        const terms = await findUnusedBandTerms(2, {sameBand: true, requireAssessments: true});
        for (const term of terms) {
            await insertBand(term, `${RUN_ID} duplicate target`);
            ids.add(term.id);
        }
        const body = await settingsBody(terms[1], {description: `${RUN_ID} collision`});
        const response = await agent.post(`/bands/${terms[0].id}/settings`).type('form').send(body);
        expect(response.status).toBe(302);
        expect(decodeURIComponent(response.headers.location)).toContain('already exists');
        const [[source]] = await pool.query('SELECT semesterId FROM semesterBand WHERE semesterBandId = ?', [terms[0].id]);
        expect(source.semesterId).toBe(terms[0].semesterId);
    });

    test('14.2.4 migrates the Band term atomically', async () => {
        const terms = await findUnusedBandTerms(2, {sameBand: true, requireAssessments: true});
        await insertBand(terms[0], `${RUN_ID} migrate`);
        ids.add(terms[0].id);
        const studentId = await createStudent(terms[0]);
        studentIds.add(studentId);
        await pool.query(
            'INSERT INTO studentSemBand (semesterId, studentId, band, movement) VALUES (?, ?, ?, ?)',
            [terms[0].semesterId, studentId, terms[0].code, 'Continue']
        );
        const [[assessment]] = await pool.query(
            'SELECT assessmentId FROM assessment WHERE band = ? ORDER BY assessmentId LIMIT 1',
            [terms[0].code]
        );
        const [assignment] = await pool.query(`
            INSERT INTO studentAssessment (studentId, assessmentId, semesterId, score, status, dueDate)
            VALUES (?, ?, ?, NULL, 'Missing', CURDATE())
        `, [studentId, assessment.assessmentId, terms[0].semesterId]);
        const body = await settingsBody(terms[1]);
        const response = await agent.post(`/bands/${terms[0].id}/settings`).type('form').send(body);
        expect(response.status).toBe(302);
        const [[row]] = await pool.query('SELECT semesterId, description FROM semesterBand WHERE semesterBandId = ?', [terms[0].id]);
        expect(row.semesterId).toBe(terms[1].semesterId);
        expect(row.description).toBe(body.description);
        const [[history]] = await pool.query(
            'SELECT semesterId FROM studentSemBand WHERE studentId = ? AND band = ?',
            [studentId, terms[0].code]
        );
        const [[student]] = await pool.query(
            'SELECT currentSemester FROM student WHERE studentId = ?', [studentId]
        );
        const [[migratedAssignment]] = await pool.query(
            'SELECT semesterId FROM studentAssessment WHERE studentAssessmentId = ?', [assignment.insertId]
        );
        expect(history.semesterId).toBe(terms[1].semesterId);
        expect(student.currentSemester).toBe(terms[1].semesterId);
        expect(migratedAssignment.semesterId).toBe(terms[1].semesterId);
    });

    test.each(['get', 'post'])('14.2.5 returns 404 for a missing Band on %s', async (method) => {
        const response = method === 'get'
            ? await agent.get('/bands/does-not-exist/settings')
            : await agent.post('/bands/does-not-exist/settings').type('form').send({});
        expect(response.status).toBe(404);
        expect(response.text).toContain('Band not found');
    });

    test('14.2.6 deletes a Band and its settings', async () => {
        const term = await seededAssessedBand();
        await agent.post(`/bands/${term.id}/settings`).type('form').send(await settingsBody(term));
        const studentId = await createStudent(term);
        studentIds.add(studentId);
        await pool.query(
            'INSERT INTO studentSemBand (semesterId, studentId, band, movement) VALUES (?, ?, ?, ?)',
            [term.semesterId, studentId, term.code, 'Continue']
        );
        const [[assessment]] = await pool.query(
            'SELECT assessmentId FROM assessment WHERE band = ? ORDER BY assessmentId LIMIT 1', [term.code]
        );
        const [assignment] = await pool.query(`
            INSERT INTO studentAssessment (studentId, assessmentId, semesterId, score, status, dueDate)
            VALUES (?, ?, ?, 100, 'Graded', CURDATE())
        `, [studentId, assessment.assessmentId, term.semesterId]);
        const [[studentBefore]] = await pool.query(
            'SELECT educatorId FROM student WHERE studentId = ?', [studentId]
        );
        await pool.query(`
            INSERT INTO assessmentSubmission
                (studentAssessmentId, submittedDate, submittedBy, filepath, score, analysis, isAccepted, reviewedBy)
            VALUES (?, CURDATE(), ?, ?, 100, ?, 1, ?)
        `, [assignment.insertId, studentBefore.educatorId, `/uploads/${RUN_ID}.pdf`, RUN_ID, studentBefore.educatorId]);
        await pool.query(
            'INSERT INTO assessment_analysis (submissionId, diagnosticSummary, isAccepted) VALUES (?, ?, 1)',
            [assignment.insertId, RUN_ID]
        );
        const response = await agent.post(`/bands/${term.id}/delete`);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/bands');
        ids.delete(term.id);
        const [[{bandCount}]] = await pool.query(
            'SELECT COUNT(*) AS bandCount FROM semesterBand WHERE semesterBandId = ?', [term.id]
        );
        const [[{educatorCount}]] = await pool.query(
            'SELECT COUNT(*) AS educatorCount FROM semesterBandEducator WHERE semesterBandId = ?', [term.id]
        );
        const [[{enrollmentCount}]] = await pool.query(
            'SELECT COUNT(*) AS enrollmentCount FROM studentSemBand WHERE studentId = ? AND semesterId = ?',
            [studentId, term.semesterId]
        );
        const [[{assignmentCount}]] = await pool.query(
            'SELECT COUNT(*) AS assignmentCount FROM studentAssessment WHERE studentAssessmentId = ?',
            [assignment.insertId]
        );
        const [[{analysisCount}]] = await pool.query(
            'SELECT COUNT(*) AS analysisCount FROM assessment_analysis WHERE submissionId = ?',
            [assignment.insertId]
        );
        const [[studentAfter]] = await pool.query(
            'SELECT currentBand FROM student WHERE studentId = ?', [studentId]
        );
        expect(Number(bandCount)).toBe(0);
        expect(Number(educatorCount)).toBe(0);
        expect(Number(enrollmentCount)).toBe(0);
        expect(Number(assignmentCount)).toBe(0);
        expect(Number(analysisCount)).toBe(0);
        expect(studentAfter.currentBand).toBeNull();
    });

    test.each([
        ['blank name', {educatorName: ['   ']}],
        ['unsupported centre', {educatorCentre: ['Centre 99']}],
        ['unsupported role', {educatorRole: ['Owner']}]
    ])('14.2.7 rejects %s without replacing settings', async (_label, override) => {
        const term = await seededAssessedBand();
        const original = await settingsBody(term);
        await agent.post(`/bands/${term.id}/settings`).type('form').send(original);
        const before = await readSettingsState(term.id);
        const response = await agent.post(`/bands/${term.id}/settings`).type('form').send({
            ...original,
            ...override,
            description: `${RUN_ID} invalid`
        });
        expect(response.status).toBe(302);
        expect(new URL(response.headers.location, 'http://test').searchParams.get('error'))
            .toContain('valid name, centre and role');
        expect(await readSettingsState(term.id)).toEqual(before);
    });
});
