const {
    app,
    request,
    pool,
    TEST_MARKER,
    cleanupAssessment,
    sweepMarkedAssessments,
    findUnusedAssessmentType
} = require('./assessmentTestHelpers');

let validSemesterId;
let validSemesterBandId;
let validBand;

const insertedAssessmentIds = [];

function track(assessmentId) {
    insertedAssessmentIds.push(assessmentId);
    return assessmentId;
}

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
        rubrics: TEST_MARKER,
        semesterId: validSemesterId,
        ...overrides
    };
}

beforeAll(async () => {
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
            'creates an assessment and initializes weight to zero',
            async () => {
                const payload =
                    await buildValidPayload();

                /*
                 * Weight must not be submitted by the
                 * Create Assessment operation.
                 */
                expect(payload).not.toHaveProperty('weight');

                const res = await request(app)
                    .post('/assessments')
                    .send(payload);

                expect(res.status).toBe(201);

                expect(res.body).toEqual({
                    message:
                        'Assessment created successfully',
                    assessmentId: expect.any(Number)
                });

                track(res.body.assessmentId);

                const [assessmentRows] =
                    await pool.query(
                        `SELECT assessmentId,
                                assessmentType,
                                component,
                                band,
                                passingMark,
                                totalMark,
                                rubrics
                         FROM assessment
                         WHERE assessmentId = ?`,
                        [res.body.assessmentId]
                    );

                expect(assessmentRows).toHaveLength(1);

                const created = assessmentRows[0];

                expect(created.assessmentType)
                    .toBe(payload.assessmentType);

                expect(created.component)
                    .toBe('Vocabulary');

                expect(created.band)
                    .toBe(validBand);

                expect(Number(created.passingMark))
                    .toBe(50);

                expect(Number(created.totalMark))
                    .toBe(100);

                expect(created.rubrics)
                    .toBe(TEST_MARKER);

                const [weightRows] =
                    await pool.query(
                        `SELECT semesterBandId,
                                assessmentId,
                                weight
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
                    weightRows[0].semesterBandId
                ).toBe(validSemesterBandId);

                expect(
                    Number(weightRows[0].assessmentId)
                ).toBe(res.body.assessmentId);

                /*
                 * New assessments always begin with
                 * weight zero.
                 */
                expect(Number(weightRows[0].weight))
                    .toBe(0);
            }
        );
    }
);

describe(
    '8.2.2 Integration Test: Reject Invalid Assessment Details',
    () => {
        test(
            'rejects passingMark greater than totalMark and creates no rows',
            async () => {
                const payload =
                    await buildValidPayload({
                        passingMark: 100,
                        totalMark: 99
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
                         WHERE assessmentType = ?
                           AND band = ?
                           AND rubrics = ?`,
                        [
                            payload.assessmentType,
                            payload.band,
                            TEST_MARKER
                        ]
                    );

                expect(Number(assessmentCount))
                    .toBe(0);

                const [[{ weightCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS weightCount
                         FROM semesterBandAssessmentWeight sbaw
                         JOIN assessment a
                           ON a.assessmentId =
                              sbaw.assessmentId
                         WHERE a.assessmentType = ?
                           AND a.band = ?
                           AND a.rubrics = ?`,
                        [
                            payload.assessmentType,
                            payload.band,
                            TEST_MARKER
                        ]
                    );

                expect(Number(weightCount)).toBe(0);
            }
        );

        test(
            'rejects missing assessmentType and creates no rows',
            async () => {
                const payload =
                    await buildValidPayload();

                const originalType =
                    payload.assessmentType;

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
                         WHERE assessmentType = ?
                           AND band = ?
                           AND rubrics = ?`,
                        [
                            originalType,
                            validBand,
                            TEST_MARKER
                        ]
                    );

                expect(Number(assessmentCount))
                    .toBe(0);
            }
        );
    }
);

describe(
    '8.2.3 Integration Test: Reject Duplicate Assessment Type',
    () => {
        test(
            'creates exactly one assessment and rejects the duplicate',
            async () => {
                const payload =
                    await buildValidPayload();

                const firstRes = await request(app)
                    .post('/assessments')
                    .send(payload);

                expect(firstRes.status).toBe(201);

                track(firstRes.body.assessmentId);

                const secondRes = await request(app)
                    .post('/assessments')
                    .send(payload);

                expect(secondRes.status).toBe(409);

                expect(secondRes.body).toEqual({
                    message:
                        'Assessment type already exists for this band'
                });

                const [assessmentRows] =
                    await pool.query(
                        `SELECT assessmentId
                         FROM assessment
                         WHERE assessmentType = ?
                           AND band = ?`,
                        [
                            payload.assessmentType,
                            payload.band
                        ]
                    );

                expect(assessmentRows).toHaveLength(1);

                expect(
                    Number(assessmentRows[0].assessmentId)
                ).toBe(firstRes.body.assessmentId);

                /*
                 * The rejected second request must not
                 * create another weight record.
                 */
                const [[{ weightCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS weightCount
                         FROM semesterBandAssessmentWeight
                         WHERE assessmentId = ?`,
                        [firstRes.body.assessmentId]
                    );

                expect(Number(weightCount)).toBe(1);
            }
        );
    }
);

describe(
    '8.2.4 Integration Test: Semester Band Does Not Exist',
    () => {
        test(
            'rolls back assessment insert when semester-band combination does not exist',
            async () => {
                const nonexistentSemesterId =
                    999999999;

                const [[{ matchCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS matchCount
                         FROM semesterBand
                         WHERE semesterId = ?
                           AND band = ?`,
                        [
                            nonexistentSemesterId,
                            validBand
                        ]
                    );

                expect(Number(matchCount)).toBe(0);

                const payload =
                    await buildValidPayload({
                        semesterId:
                            nonexistentSemesterId
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
                 * createAssessment inserts the assessment
                 * before looking up semesterBand. This
                 * assertion proves that rollback removed it.
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

                expect(Number(assessmentCount))
                    .toBe(0);
            }
        );
    }
);