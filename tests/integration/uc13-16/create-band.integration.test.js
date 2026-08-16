const {
    RUN_ID,
    BAND_NAMES,
    pool,
    bandIdFor,
    createAuthenticatedAgent,
    removeAuthFixture,
    sweepMarkedEducators,
    findUnusedBandTerms,
    insertBand,
    cleanupBand,
    sweepMarkedBands,
    sweepMarkedStudents
} = require('./bandIntegrationHelpers');

jest.setTimeout(30000);

let agent;
const createdBandIds = new Set();

beforeAll(async () => {
    await sweepMarkedStudents();
    await sweepMarkedBands();
    await sweepMarkedEducators();
    agent = await createAuthenticatedAgent();
});

afterEach(async () => {
    for (const id of createdBandIds) await cleanupBand(id);
    createdBandIds.clear();
});

afterAll(async () => {
    await sweepMarkedStudents();
    await sweepMarkedBands();
    await removeAuthFixture();
    await pool.end();
});

describe('UC13 Create and View Band integration', () => {
    test('13.2.1 creates, persists, redirects to, and renders a Band', async () => {
        const [term] = await findUnusedBandTerms();
        const description = `${RUN_ID} create success`;
        createdBandIds.add(term.id);

        const response = await agent.post('/bands').type('form').send({
            name: term.name,
            year: term.year,
            semester: term.semester,
            description
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`/bands/${term.id}/settings`);
        const [[row]] = await pool.query(
            'SELECT semesterId, band, description FROM semesterBand WHERE semesterBandId = ?',
            [term.id]
        );
        expect(row).toEqual(expect.objectContaining({
            semesterId: term.semesterId,
            band: term.code,
            description
        }));
        const rendered = await agent.get(response.headers.location);
        expect(rendered.status).toBe(200);
        expect(rendered.text).toContain(description);
        expect(rendered.text).toContain(term.semester);
        expect(rendered.text).toContain(String(term.year));
    });

    test('13.2.2 rejects a duplicate without creating a second row', async () => {
        const [term] = await findUnusedBandTerms();
        createdBandIds.add(term.id);
        const body = {name: term.name, year: term.year, semester: term.semester, description: RUN_ID};
        expect((await agent.post('/bands').type('form').send(body)).status).toBe(302);
        const duplicate = await agent.post('/bands').type('form').send(body);
        expect(duplicate.status).toBe(302);
        expect(duplicate.headers.location).toContain('/bands?');
        expect(new URL(duplicate.headers.location, 'http://test').searchParams.get('error')).toContain('already exists');
        const [[{count}]] = await pool.query(
            'SELECT COUNT(*) AS count FROM semesterBand WHERE semesterId = ? AND band = ?',
            [term.semesterId, term.code]
        );
        expect(Number(count)).toBe(1);
    });

    test.each([
        ['invalid Band', {name: 'Band Z99', year: 2026, semester: 'Semester 1'}],
        ['unsupported year', {name: 'Band A1', year: 2040, semester: 'Semester 1'}],
        ['missing semester', {name: 'Band A1', year: 2026, semester: ''}]
    ])('13.2.3 rejects %s without database mutation', async (_label, body) => {
        const [[{beforeCount}]] = await pool.query(
            'SELECT COUNT(*) AS beforeCount FROM semesterBand WHERE description = ?', [RUN_ID]
        );
        const [[{beforeSemesters}]] = await pool.query('SELECT COUNT(*) AS beforeSemesters FROM semester');
        const response = await agent.post('/bands').type('form').send({...body, description: RUN_ID});
        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('/bands?');
        const redirect = new URL(response.headers.location, 'http://test');
        expect(redirect.searchParams.get('error')).toBeTruthy();
        expect(redirect.searchParams.get('name')).toBe(body.name);
        expect(redirect.searchParams.get('year')).toBe(String(body.year));
        expect(redirect.searchParams.get('semester')).toBe(body.semester);
        const [[{afterCount}]] = await pool.query(
            'SELECT COUNT(*) AS afterCount FROM semesterBand WHERE description = ?', [RUN_ID]
        );
        const [[{afterSemesters}]] = await pool.query('SELECT COUNT(*) AS afterSemesters FROM semester');
        expect(Number(afterCount)).toBe(Number(beforeCount));
        expect(Number(afterSemesters)).toBe(Number(beforeSemesters));
    });

    test('13.2.4 accepts 2000 characters and rejects 2001 characters', async () => {
        const terms = await findUnusedBandTerms(2);
        const accepted = `${RUN_ID}${'x'.repeat(2000 - RUN_ID.length)}`;
        createdBandIds.add(terms[0].id);
        const success = await agent.post('/bands').type('form').send({
            name: terms[0].name, year: terms[0].year, semester: terms[0].semester, description: accepted
        });
        expect(success.status).toBe(302);
        const [[stored]] = await pool.query(
            'SELECT description FROM semesterBand WHERE semesterBandId = ?', [terms[0].id]
        );
        expect(stored.description).toBe(accepted);

        const rejected = await agent.post('/bands').type('form').send({
            name: terms[1].name, year: terms[1].year, semester: terms[1].semester,
            description: 'x'.repeat(2001)
        });
        expect(rejected.status).toBe(302);
        expect(new URL(rejected.headers.location, 'http://test').searchParams.get('error'))
            .toContain('2000 characters or fewer');
        const [[{count}]] = await pool.query(
            'SELECT COUNT(*) AS count FROM semesterBand WHERE semesterBandId = ?', [terms[1].id]
        );
        expect(Number(count)).toBe(0);
    });

    test('13.2.5 renders terms newest first and Bands in defined sequence', async () => {
        const [semesters] = await pool.query(`
            SELECT semesterId, academicYear, semesterNo
            FROM semester WHERE academicYear BETWEEN 2026 AND 2035
            ORDER BY academicYear DESC, semesterNo DESC
        `);
        const [occupied] = await pool.query(`
            SELECT sb.semesterBandId, sb.semesterId, sb.band, s.academicYear, s.semesterNo
            FROM semesterBand sb INNER JOIN semester s ON s.semesterId = sb.semesterId
        `);
        const used = new Set(occupied.map((row) => `${row.academicYear}:${row.semesterNo}:${row.band}`));
        const usedIds = new Set(occupied.map((row) => row.semesterBandId));
        let terms;
        for (const semester of semesters) {
            const available = BAND_NAMES.filter((name) => {
                const code = name.replace('Band ', '');
                const id = bandIdFor(name, semester.academicYear, `Semester ${semester.semesterNo}`);
                return !used.has(`${semester.academicYear}:${semester.semesterNo}:${code}`) && !usedIds.has(id);
            });
            if (available.length < 3) continue;
            terms = available.slice(0, 3).map((name) => ({
                name,
                code: name.replace('Band ', ''),
                semesterId: semester.semesterId,
                year: Number(semester.academicYear),
                semester: `Semester ${semester.semesterNo}`,
                id: bandIdFor(name, semester.academicYear, `Semester ${semester.semesterNo}`)
            }));
            break;
        }
        if (!terms) throw new Error('Test database lacks a term with three unused Bands');
        for (const [index, term] of [...terms].reverse().entries()) {
            await insertBand(term, `${RUN_ID} list ${index}`);
            createdBandIds.add(term.id);
        }
        const response = await agent.get('/bands');
        expect(response.status).toBe(200);
        for (const term of terms) expect(response.text).toContain(`/assessments/${term.id}/view`);
        const positions = terms.map((term) => response.text.indexOf(`/assessments/${term.id}/view`));
        expect(positions.every((position) => position >= 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });
});
