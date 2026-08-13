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

let semesterBand;
const insertedAssessmentIds = [];

function track(assessmentId) {
    insertedAssessmentIds.push(assessmentId);
    return assessmentId;
}

function buildEditPayload(assessment, overrides = {}) {
    return {
        assessmentType: assessment.assessmentType,
        component: assessment.component,
        band: assessment.band,
        passingMark: assessment.passingMark,
        totalMark: assessment.totalMark,
        weight: assessment.weight,
        rubrics: assessment.rubrics,
        semesterId: semesterBand.semesterId,
        ...overrides
    };
}

beforeAll(async () => {
    semesterBand = await getAnySemesterBand();
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
    '11.2.1 Integration Test: Edit Unpublished Assessment',
    () => {
        test(
            'updates all editable assessment fields successfully',
            async () => {
                const assessment =
                    await insertTestAssessment({
                        band: semesterBand.band,
                        semesterBandId:
                            semesterBand.semesterBandId,
                        rubrics: `${TEST_MARKER}_EDIT`
                    });

                track(assessment.assessmentId);

                const updatedType =
                    await findUnusedAssessmentType(
                        semesterBand.band
                    );

                const payload = buildEditPayload(
                    assessment,
                    {
                        assessmentType: updatedType,
                        component: 'Writing',
                        passingMark: 40,
                        totalMark: 80,
                        weight: 0,
                        rubrics:
                            `${TEST_MARKER}_UPDATED`
                    }
                );

                const res = await request(app)
                    .put(
                        `/assessments/${assessment.assessmentId}`
                    )
                    .send(payload);

                expect(res.status).toBe(200);

                expect(res.body).toEqual({
                    message:
                        'Assessment updated successfully'
                });

                const [[updated]] = await pool.query(
                    `SELECT *
                     FROM assessment
                     WHERE assessmentId = ?`,
                    [assessment.assessmentId]
                );

                expect(updated.assessmentType)
                    .toBe(updatedType);

                expect(updated.component)
                    .toBe('Writing');

                expect(Number(updated.passingMark))
                    .toBe(40);

                expect(Number(updated.totalMark))
                    .toBe(80);

                expect(updated.rubrics)
                    .toBe(`${TEST_MARKER}_UPDATED`);

                const [[weightRow]] =
                    await pool.query(
                        `SELECT weight
                         FROM semesterBandAssessmentWeight
                         WHERE semesterBandId = ?
                           AND assessmentId = ?`,
                        [
                            semesterBand.semesterBandId,
                            assessment.assessmentId
                        ]
                    );

                expect(Number(weightRow.weight)).toBe(0);
            }
        );
    }
);

describe(
    '11.2.2 Integration Test: Reject Invalid Edit',
    () => {
        test(
            'rejects passingMark greater than totalMark',
            async () => {
                const assessment =
                    await insertTestAssessment({
                        band: semesterBand.band,
                        semesterBandId:
                            semesterBand.semesterBandId,
                        rubrics:
                            `${TEST_MARKER}_INVALID_EDIT`
                    });

                track(assessment.assessmentId);

                const res = await request(app)
                    .put(
                        `/assessments/${assessment.assessmentId}`
                    )
                    .send(
                        buildEditPayload(
                            assessment,
                            {
                                passingMark: 101,
                                totalMark: 100
                            }
                        )
                    );

                expect(res.status).toBe(400);

                expect(res.body).toEqual({
                    message:
                        'Passing Mark cannot exceed Total Mark'
                });

                const [[unchanged]] =
                    await pool.query(
                        `SELECT passingMark, totalMark
                         FROM assessment
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                expect(Number(unchanged.passingMark))
                    .toBe(50);

                expect(Number(unchanged.totalMark))
                    .toBe(100);
            }
        );
    }
);

describe(
    '11.2.3 Integration Test: Reject Nonexistent Assessment',
    () => {
        test(
            'returns 404 for an assessment that does not exist',
            async () => {
                const fakeAssessment = {
                    assessmentType: 'Fluency',
                    component: 'Vocabulary',
                    band: semesterBand.band,
                    passingMark: 50,
                    totalMark: 100,
                    weight: 0,
                    rubrics: TEST_MARKER
                };

                const res = await request(app)
                    .put('/assessments/999999999')
                    .send(
                        buildEditPayload(fakeAssessment)
                    );

                expect(res.status).toBe(404);

                expect(res.body).toEqual({
                    message: 'Assessment not found'
                });
            }
        );
    }
);