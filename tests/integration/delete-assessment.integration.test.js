const {
    app,
    request,
    pool,
    TEST_MARKER,
    cleanupAssessment,
    sweepMarkedAssessments,
    getSemesterBandWithStudents,
    insertTestAssessment
} = require('./assessmentTestHelpers');

let semesterBand;
const insertedAssessmentIds = [];

beforeAll(async () => {
    semesterBand =
        await getSemesterBandWithStudents();

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

async function createAssessment() {
    const assessment =
        await insertTestAssessment({
            band: semesterBand.band,
            semesterBandId:
                semesterBand.semesterBandId,
            rubrics: `${TEST_MARKER}_DELETE`
        });

    insertedAssessmentIds.push(
        assessment.assessmentId
    );

    return assessment;
}

describe(
    '18.2.1 Integration Test: Delete Assessment Successfully',
    () => {
        test(
            'deletes assessment and its weight record',
            async () => {
                const assessment =
                    await createAssessment();

                const res = await request(app)
                    .delete(
                        `/assessments/${assessment.assessmentId}`
                    );

                expect(res.status).toBe(200);

                expect(res.body).toEqual({
                    message:
                        'Assessment deleted successfully'
                });

                const [assessmentRows] =
                    await pool.query(
                        `SELECT assessmentId
                         FROM assessment
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                expect(assessmentRows).toHaveLength(0);

                const [weightRows] =
                    await pool.query(
                        `SELECT assessmentId
                         FROM semesterBandAssessmentWeight
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                expect(weightRows).toHaveLength(0);

                /*
                 * It has already been deleted, so prevent
                 * afterEach from trying to clean it again.
                 */
                insertedAssessmentIds.splice(
                    insertedAssessmentIds.indexOf(
                        assessment.assessmentId
                    ),
                    1
                );
            }
        );
    }
);

describe(
    '18.2.2 Integration Test: Reject Published Assessment',
    () => {
        test(
            'preserves assessment and weight when published records exist',
            async () => {
                const assessment =
                    await createAssessment();

                const publishRes = await request(app)
                    .post(
                        `/assessments/${assessment.assessmentId}/publish`
                    )
                    .send({
                        semesterId:
                            semesterBand.semesterId,
                        dueDate: '2030-12-31'
                    });

                expect(publishRes.status).toBe(200);

                const res = await request(app)
                    .delete(
                        `/assessments/${assessment.assessmentId}`
                    );

                expect(res.status).toBe(409);

                expect(res.body).toEqual({
                    message:
                        'Cannot delete: this assessment has published records'
                });

                const [assessmentRows] =
                    await pool.query(
                        `SELECT assessmentId
                         FROM assessment
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                expect(assessmentRows).toHaveLength(1);

                const [weightRows] =
                    await pool.query(
                        `SELECT assessmentId
                         FROM semesterBandAssessmentWeight
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                expect(weightRows).toHaveLength(1);
            }
        );
    }
);

describe(
    '18.2.3 Integration Test: Nonexistent Assessment',
    () => {
        test(
            'returns 404 and does not remove unrelated assessments',
            async () => {
                const assessment =
                    await createAssessment();

                const res = await request(app)
                    .delete(
                        '/assessments/999999999'
                    );

                expect(res.status).toBe(404);

                expect(res.body).toEqual({
                    message:
                        'Assessment not found'
                });

                const [assessmentRows] =
                    await pool.query(
                        `SELECT assessmentId
                         FROM assessment
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                expect(assessmentRows).toHaveLength(1);
            }
        );
    }
);