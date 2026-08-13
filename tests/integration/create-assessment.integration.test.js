const {
    app,
    request,
    pool,
    TEST_MARKER,
    cleanupAssessment,
    sweepMarkedAssessments,
    getAnySemesterBand,
    findUnusedAssessmentType,
    insertTestAssessment
} = require('./assessmentTestHelpers');

let validSemesterId;
let validSemesterBandId;
let validBand;

const insertedAssessmentIds = [];

/*
 * These values must match the valid assessment values accepted by
 * validateAssessmentBody().
 */
const validAssessmentTypes = [
    'Letter Formation',
    'Narrative Writing',
    'Exposition Writing',
    'Edit and Diagram 1',
    'Edit and Diagram 2',
    'Edit and Diagram 3',
    'Comprehension',
    'Primary',
    'Secondary',
    'Picture Naming',
    'Picture Description',
    'PA Identification',
    'Phonics',
    'Word Reading Accuracy',
    'Fluency',
    'Word Spelling'
];

async function buildValidPayload(overrides = {}) {
    const assessmentType =
        await findUnusedAssessmentType(validBand);

    if (!assessmentType) {
        throw new Error(
            `No unused assessment type is available for band ${validBand}`
        );
    }

    return {
        assessmentType,
        component: 'Vocabulary',
        band: validBand,
        passingMark: 50,
        totalMark: 100,

        /*
         * Weight is initialized to zero because actual weightage is
         * managed by the separate Band Settings implementation.
         */
        weight: 0,

        rubrics: TEST_MARKER,
        semesterId: validSemesterId,
        ...overrides
    };
}

beforeAll(async () => {
    /*
     * Choose a real semester-band foreign-key record instead of
     * assuming a particular fixture exists.
     */
    const [[semesterBand]] = await pool.query(
        `SELECT semesterBandId, semesterId, band
         FROM semesterBand
         ORDER BY semesterId
         LIMIT 1`
    );

    if (!semesterBand) {
        throw new Error(
            'The integration database has no semesterBand records'
        );
    }

    validSemesterBandId =
        semesterBand.semesterBandId;

    validSemesterId =
        semesterBand.semesterId;

    validBand =
        semesterBand.band;

    await sweepMarkedAssessments();
});

afterEach(async () => {
    for (const assessmentId of insertedAssessmentIds) {
        await cleanupAssessment(assessmentId);
    }

    insertedAssessmentIds.length = 0;
});

afterAll(async () => {
    await sweepMarkedAssessments();
    await pool.end();
});

describe(
    '8.2.1 Integration Test: Create Assessment Successfully',
    () => {
        test(
            'creates an assessment and initializes its weight to zero',
            async () => {
                const payload =
                    await buildValidPayload();

                const res = await request(app)
                    .post('/assessments')
                    .send(payload);

                expect(res.status).toBe(201);

                expect(res.body).toEqual({
                    message:
                        'Assessment created successfully',
                    assessmentId: expect.any(Number)
                });

                insertedAssessmentIds.push(
                    res.body.assessmentId
                );

                /*
                 * Verify the assessment was actually persisted.
                 */
                const [assessmentRows] =
                    await pool.query(
                        `SELECT *
                         FROM assessment
                         WHERE assessmentId = ?`,
                        [res.body.assessmentId]
                    );

                expect(assessmentRows).toHaveLength(1);

                expect(
                    assessmentRows[0].assessmentType
                ).toBe(payload.assessmentType);

                expect(
                    assessmentRows[0].component
                ).toBe('Vocabulary');

                expect(
                    assessmentRows[0].band
                ).toBe(validBand);

                expect(
                    Number(
                        assessmentRows[0].passingMark
                    )
                ).toBe(50);

                expect(
                    Number(
                        assessmentRows[0].totalMark
                    )
                ).toBe(100);

                expect(
                    assessmentRows[0].rubrics
                ).toBe(TEST_MARKER);

                /*
                 * Verify the connected weight row was created.
                 */
                const [weightRows] =
                    await pool.query(
                        `SELECT *
                         FROM semesterBandAssessmentWeight
                         WHERE semesterBandId = ?
                           AND assessmentId = ?`,
                        [
                            validSemesterBandId,
                            res.body.assessmentId
                        ]
                    );

                expect(weightRows).toHaveLength(1);

                expect(
                    Number(weightRows[0].weight)
                ).toBe(0);
            }
        );
    }
);

describe(
    '8.2.2 Integration Test: Invalid Assessment Details',
    () => {
        test(
            'rejects passingMark greater than totalMark and creates no rows',
            async () => {
                const payload =
                    await buildValidPayload({
                        passingMark: 101,
                        totalMark: 100
                    });

                const res = await request(app)
                    .post('/assessments')
                    .send(payload);

                expect(res.status).toBe(400);

                expect(res.body).toEqual({
                    message:
                        'Passing Mark cannot exceed Total Mark'
                });

                const [[{ assessmentCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS assessmentCount
                         FROM assessment
                         WHERE rubrics = ?`,
                        [TEST_MARKER]
                    );

                expect(
                    Number(assessmentCount)
                ).toBe(0);
            }
        );

        test(
            'rejects missing assessment type and creates no rows',
            async () => {
                const payload =
                    await buildValidPayload();

                delete payload.assessmentType;

                const res = await request(app)
                    .post('/assessments')
                    .send(payload);

                expect(res.status).toBe(400);

                expect(res.body).toEqual({
                    message: 'All fields are required'
                });

                const [[{ assessmentCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS assessmentCount
                         FROM assessment
                         WHERE rubrics = ?`,
                        [TEST_MARKER]
                    );

                expect(
                    Number(assessmentCount)
                ).toBe(0);
            }
        );
    }
);

describe(
    '8.2.3 Integration Test: Duplicate Assessment Type',
    () => {
        test(
            'rejects a second assessment using the same type and band',
            async () => {
                const payload =
                    await buildValidPayload();

                const firstRes = await request(app)
                    .post('/assessments')
                    .send(payload);

                expect(firstRes.status).toBe(201);

                insertedAssessmentIds.push(
                    firstRes.body.assessmentId
                );

                const secondRes = await request(app)
                    .post('/assessments')
                    .send(payload);

                expect(secondRes.status).toBe(409);

                expect(secondRes.body).toEqual({
                    message:
                        'Assessment type already exists for this band'
                });

                const [[{ assessmentCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS assessmentCount
                         FROM assessment
                         WHERE assessmentType = ?
                           AND band = ?`,
                        [
                            payload.assessmentType,
                            payload.band
                        ]
                    );

                expect(
                    Number(assessmentCount)
                ).toBe(1);
            }
        );
    }
);

describe(
    '8.2.4 Integration Test: Semester Band Not Found',
    () => {
        test(
            'rolls back the assessment insert when no semester band exists',
            async () => {
                const payload =
                    await buildValidPayload({
                        semesterId: 999999999
                    });

                const res = await request(app)
                    .post('/assessments')
                    .send(payload);

                expect(res.status).toBe(404);

                expect(res.body).toEqual({
                    message:
                        'No matching band found for this semester'
                });

                /*
                 * createAssessment inserts the assessment before
                 * looking up semesterBand. This assertion proves the
                 * transaction correctly rolled the insert back.
                 */
                const [[{ assessmentCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS assessmentCount
                         FROM assessment
                         WHERE assessmentType = ?
                           AND band = ?
                           AND rubrics = ?`,
                        [
                            payload.assessmentType,
                            payload.band,
                            TEST_MARKER
                        ]
                    );

                expect(
                    Number(assessmentCount)
                ).toBe(0);
            }
        );
    }
);