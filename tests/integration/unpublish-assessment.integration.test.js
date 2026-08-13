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
            rubrics: `${TEST_MARKER}_UNPUBLISH`
        });

    insertedAssessmentIds.push(
        assessment.assessmentId
    );

    return assessment;
}

async function publish(assessmentId) {
    return request(app)
        .post(
            `/assessments/${assessmentId}/publish`
        )
        .send({
            semesterId: semesterBand.semesterId,
            dueDate: '2030-12-31'
        });
}

describe(
    '17.2.1 Integration Test: Unpublish Successfully',
    () => {
        test(
            'deletes all unsubmitted assignment records',
            async () => {
                const assessment =
                    await createAssessment();

                const publishRes =
                    await publish(
                        assessment.assessmentId
                    );

                expect(publishRes.status).toBe(200);

                const res = await request(app)
                    .post(
                        `/assessments/${assessment.assessmentId}/unpublish`
                    )
                    .send({
                        semesterId:
                            semesterBand.semesterId
                    });

                expect(res.status).toBe(200);

                expect(res.body).toEqual({
                    message:
                        'Assessment unpublished successfully'
                });

                const [[{ assignmentCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS assignmentCount
                         FROM studentAssessment
                         WHERE assessmentId = ?
                           AND semesterId = ?`,
                        [
                            assessment.assessmentId,
                            semesterBand.semesterId
                        ]
                    );

                expect(Number(assignmentCount))
                    .toBe(0);

                const [[assessmentRow]] =
                    await pool.query(
                        `SELECT assessmentId
                         FROM assessment
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                expect(assessmentRow).toBeDefined();
            }
        );
    }
);

describe(
    '17.2.2 Integration Test: Assessment Not Published',
    () => {
        test(
            'rejects unpublishing an unpublished assessment',
            async () => {
                const assessment =
                    await createAssessment();

                const res = await request(app)
                    .post(
                        `/assessments/${assessment.assessmentId}/unpublish`
                    )
                    .send({
                        semesterId:
                            semesterBand.semesterId
                    });

                expect(res.status).toBe(400);

                expect(res.body).toEqual({
                    message:
                        'This assessment is not published for this semester'
                });
            }
        );
    }
);

describe(
    '17.2.3 Integration Test: Has Submissions',
    () => {
        test(
            'rejects unpublishing and preserves all assignments',
            async () => {
                const assessment =
                    await createAssessment();

                const publishRes =
                    await publish(
                        assessment.assessmentId
                    );

                expect(publishRes.status).toBe(200);

                const [[submittedRow]] =
                    await pool.query(
                        `SELECT studentAssessmentId
                         FROM studentAssessment
                         WHERE assessmentId = ?
                         LIMIT 1`,
                        [assessment.assessmentId]
                    );

                await pool.query(
                    `UPDATE studentAssessment
                     SET status = 'Submitted'
                     WHERE studentAssessmentId = ?`,
                    [
                        submittedRow
                            .studentAssessmentId
                    ]
                );

                const [[{ beforeCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS beforeCount
                         FROM studentAssessment
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                const res = await request(app)
                    .post(
                        `/assessments/${assessment.assessmentId}/unpublish`
                    )
                    .send({
                        semesterId:
                            semesterBand.semesterId
                    });

                expect(res.status).toBe(409);

                expect(res.body).toEqual({
                    message:
                        'Cannot unpublish: students have already submitted work'
                });

                const [[{ afterCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS afterCount
                         FROM studentAssessment
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                expect(Number(afterCount))
                    .toBe(Number(beforeCount));
            }
        );
    }
);

describe(
    '17.2.4 Integration Test: Missing Semester ID',
    () => {
        test(
            'returns 400 and preserves assignments',
            async () => {
                const assessment =
                    await createAssessment();

                await publish(
                    assessment.assessmentId
                );

                const res = await request(app)
                    .post(
                        `/assessments/${assessment.assessmentId}/unpublish`
                    )
                    .send({});

                expect(res.status).toBe(400);

                expect(res.body).toEqual({
                    message:
                        'semesterId is required'
                });

                const [[{ assignmentCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS assignmentCount
                         FROM studentAssessment
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                expect(Number(assignmentCount))
                    .toBeGreaterThan(0);
            }
        );
    }
);