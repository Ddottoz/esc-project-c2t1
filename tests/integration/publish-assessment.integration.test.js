const {
    app,
    request,
    pool,
    TEST_MARKER,
    cleanupAssessment,
    sweepMarkedAssessments,
    getSemesterBandWithStudents,
    insertTestAssessment,
    getStudentsForSemesterBand
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

async function createPublishableAssessment() {
    const assessment =
        await insertTestAssessment({
            band: semesterBand.band,
            semesterBandId:
                semesterBand.semesterBandId,
            rubrics: `${TEST_MARKER}_PUBLISH`,
            weight: 0
        });

    insertedAssessmentIds.push(
        assessment.assessmentId
    );

    return assessment;
}

describe(
    '12.2.1 Integration Test: Publish Assessment Successfully',
    () => {
        test(
            'creates one assignment for every matching student',
            async () => {
                const assessment =
                    await createPublishableAssessment();

                const students =
                    await getStudentsForSemesterBand(
                        semesterBand
                    );

                const dueDate = '2030-12-31';

                const res = await request(app)
                    .post(
                        `/assessments/${assessment.assessmentId}/publish`
                    )
                    .send({
                        semesterId:
                            semesterBand.semesterId,
                        dueDate
                    });

                expect(res.status).toBe(200);

                expect(res.body).toEqual({
                    message:
                        'Assessment published successfully',
                    studentsAssigned: students.length
                });

                const [assignments] =
                    await pool.query(
                        `SELECT *
                         FROM studentAssessment
                         WHERE assessmentId = ?
                           AND semesterId = ?`,
                        [
                            assessment.assessmentId,
                            semesterBand.semesterId
                        ]
                    );

                expect(assignments)
                    .toHaveLength(students.length);

                for (const assignment of assignments) {
                    expect(assignment.status)
                        .toBe('Assigned');

                    expect(
                        assignment.dueDate
                    ).not.toBeNull();
                }
            }
        );
    }
);

describe(
    '12.2.2 Integration Test: Missing Publish Details',
    () => {
        test(
            'rejects request without a due date',
            async () => {
                const assessment =
                    await createPublishableAssessment();

                const res = await request(app)
                    .post(
                        `/assessments/${assessment.assessmentId}/publish`
                    )
                    .send({
                        semesterId:
                            semesterBand.semesterId
                    });

                expect(res.status).toBe(400);

                expect(res.body).toEqual({
                    message:
                        'semesterId and dueDate are required'
                });

                const [[{ assignmentCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS assignmentCount
                         FROM studentAssessment
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                expect(Number(assignmentCount))
                    .toBe(0);
            }
        );
    }
);

describe(
    '12.2.3 Integration Test: Already Published',
    () => {
        test(
            'rejects a second publication for the same semester',
            async () => {
                const assessment =
                    await createPublishableAssessment();

                const body = {
                    semesterId:
                        semesterBand.semesterId,
                    dueDate: '2030-12-31'
                };

                const firstRes = await request(app)
                    .post(
                        `/assessments/${assessment.assessmentId}/publish`
                    )
                    .send(body);

                expect(firstRes.status).toBe(200);

                const secondRes = await request(app)
                    .post(
                        `/assessments/${assessment.assessmentId}/publish`
                    )
                    .send(body);

                expect(secondRes.status).toBe(409);

                expect(secondRes.body).toEqual({
                    message:
                        'Already published for this semester'
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
                    .toBe(firstRes.body.studentsAssigned);
            }
        );
    }
);

describe(
    '12.2.4 Integration Test: Nonexistent Assessment',
    () => {
        test(
            'returns 404 without inserting assignments',
            async () => {
                const res = await request(app)
                    .post(
                        '/assessments/999999999/publish'
                    )
                    .send({
                        semesterId:
                            semesterBand.semesterId,
                        dueDate: '2030-12-31'
                    });

                expect(res.status).toBe(404);

                expect(res.body).toEqual({
                    message: 'Assessment not found'
                });
            }


        );
    }


);

describe(
    '12.2.5 Integration test: No students',
    () => {

        test('rejects publishing when the band has no students', async () => {
            const [[emptySemesterBand]] = await pool.query(
                `SELECT sb.semesterBandId, sb.semesterId, sb.band
            FROM semesterBand sb
            LEFT JOIN student s
                ON s.currentSemester = sb.semesterId
                AND s.currentBand = sb.band
            GROUP BY
                sb.semesterBandId,
                sb.semesterId,
                sb.band
            HAVING COUNT(s.studentId) = 0
            LIMIT 1`
            );

            if (!emptySemesterBand) {
                throw new Error(
                    'Test database needs a semester-band with zero students'
                );
            }

            const assessment = await insertTestAssessment({
                band: emptySemesterBand.band,
                semesterBandId:
                    emptySemesterBand.semesterBandId,
                rubrics: `${TEST_MARKER}_NO_STUDENTS`
            });

            insertedAssessmentIds.push(
                assessment.assessmentId
            );

            const res = await request(app)
                .post(
                    `/assessments/${assessment.assessmentId}/publish`
                )
                .send({
                    semesterId:
                        emptySemesterBand.semesterId,
                    dueDate: '2030-12-31'
                });

            expect(res.status).toBe(400);

            expect(res.body).toEqual({
                message:
                    'No students found for this band in this semester'
            });
        });
    });