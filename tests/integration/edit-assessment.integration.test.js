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
let historicalSemesterId;
let validStudentId;

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
        passingMark:
            Number(assessment.passingMark),
        totalMark:
            Number(assessment.totalMark),
        rubrics: assessment.rubrics,
        semesterId: semesterBand.semesterId,
        ...overrides
    };
}

async function getWeight(assessmentId) {
    const [[weightRow]] = await pool.query(
        `SELECT weight
         FROM semesterBandAssessmentWeight
         WHERE semesterBandId = ?
           AND assessmentId = ?`,
        [
            semesterBand.semesterBandId,
            assessmentId
        ]
    );

    return weightRow
        ? Number(weightRow.weight)
        : null;
}

async function setWeight(
    assessmentId,
    weight
) {
    await pool.query(
        `UPDATE semesterBandAssessmentWeight
         SET weight = ?
         WHERE semesterBandId = ?
           AND assessmentId = ?`,
        [
            weight,
            semesterBand.semesterBandId,
            assessmentId
        ]
    );
}

async function publishForTest(
    assessmentId,
    semesterId,
    status = 'Assigned'
) {
    await pool.query(
        `INSERT INTO studentAssessment
            (
                studentId,
                assessmentId,
                semesterId,
                status,
                dueDate
            )
         VALUES (?, ?, ?, ?, ?)`,
        [
            validStudentId,
            assessmentId,
            semesterId,
            status,
            '2026-09-30'
        ]
    );
}

beforeAll(async () => {
    await sweepMarkedAssessments();

    /*
     * Find a band offered in at least two semesters.
     * This lets the tests distinguish historical
     * publication from current-semester publication.
     */
    const [[semesterPair]] = await pool.query(
        `SELECT currentBand.semesterBandId,
                currentBand.semesterId,
                currentBand.band,
                historicalBand.semesterId
                    AS historicalSemesterId
         FROM semesterBand currentBand
         JOIN semesterBand historicalBand
           ON historicalBand.band =
              currentBand.band
          AND historicalBand.semesterId <>
              currentBand.semesterId
         ORDER BY currentBand.semesterId DESC
         LIMIT 1`
    );

    if (semesterPair) {
        semesterBand = {
            semesterBandId:
                semesterPair.semesterBandId,
            semesterId:
                semesterPair.semesterId,
            band:
                semesterPair.band
        };

        historicalSemesterId =
            semesterPair.historicalSemesterId;
    } else {
        /*
         * These tests can still run except for the
         * historical-publication cases.
         */
        semesterBand =
            await getAnySemesterBand();

        historicalSemesterId = null;
    }

    const [[student]] = await pool.query(
        `SELECT studentId
         FROM student
         ORDER BY studentId
         LIMIT 1`
    );

    if (!student) {
        throw new Error(
            'The integration database has no student record'
        );
    }

    validStudentId = student.studentId;
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
    '11.2.1 Integration Test: Edit Never-Published Assessment',
    () => {
        test(
            'updates core fields and rubrics without changing weight',
            async () => {
                const assessment =
                    await insertTestAssessment({
                        band: semesterBand.band,
                        semesterBandId:
                            semesterBand.semesterBandId,
                        rubrics:
                            `${TEST_MARKER}_EDIT_SUCCESS`
                    });

                track(assessment.assessmentId);

                /*
                 * Use a non-zero weight to prove that
                 * assessment editing does not overwrite it.
                 */
                await setWeight(
                    assessment.assessmentId,
                    25
                );

                const originalWeight =
                    await getWeight(
                        assessment.assessmentId
                    );

                expect(originalWeight).toBe(25);

                const updatedType =
                    await findUnusedAssessmentType(
                        semesterBand.band
                    );

                if (!updatedType) {
                    throw new Error(
                        `No unused assessment type is available for band ${semesterBand.band}`
                    );
                }

                const payload = buildEditPayload(
                    assessment,
                    {
                        assessmentType: updatedType,
                        component: 'Writing',
                        passingMark: 40,
                        totalMark: 80,
                        rubrics:
                            `${TEST_MARKER}_UPDATED`
                    }
                );

                expect(payload)
                    .not.toHaveProperty('weight');

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
                    `SELECT assessmentType,
                            component,
                            band,
                            passingMark,
                            totalMark,
                            rubrics
                     FROM assessment
                     WHERE assessmentId = ?`,
                    [assessment.assessmentId]
                );

                expect(updated.assessmentType)
                    .toBe(updatedType);

                expect(updated.component)
                    .toBe('Writing');

                expect(updated.band)
                    .toBe(semesterBand.band);

                expect(Number(updated.passingMark))
                    .toBe(40);

                expect(Number(updated.totalMark))
                    .toBe(80);

                expect(updated.rubrics)
                    .toBe(`${TEST_MARKER}_UPDATED`);

                /*
                 * Weight is managed elsewhere and must
                 * remain unchanged.
                 */
                expect(
                    await getWeight(
                        assessment.assessmentId
                    )
                ).toBe(25);
            }
        );
    }
);

describe(
    '11.2.2 Integration Test: Edit Does Not Change Weight',
    () => {
        test(
            'leaves the existing weight unchanged when editing rubrics',
            async () => {
                const assessment =
                    await insertTestAssessment({
                        band: semesterBand.band,
                        semesterBandId:
                            semesterBand.semesterBandId,
                        rubrics:
                            `${TEST_MARKER}_WEIGHT`
                    });

                track(assessment.assessmentId);

                await setWeight(
                    assessment.assessmentId,
                    35
                );

                const payload = buildEditPayload(
                    assessment,
                    {
                        rubrics:
                            `${TEST_MARKER}_WEIGHT_UPDATED`
                    }
                );

                expect(payload)
                    .not.toHaveProperty('weight');

                const res = await request(app)
                    .put(
                        `/assessments/${assessment.assessmentId}`
                    )
                    .send(payload);

                expect(res.status).toBe(200);

                const [[updated]] = await pool.query(
                    `SELECT rubrics
                     FROM assessment
                     WHERE assessmentId = ?`,
                    [assessment.assessmentId]
                );

                expect(updated.rubrics).toBe(
                    `${TEST_MARKER}_WEIGHT_UPDATED`
                );

                expect(
                    await getWeight(
                        assessment.assessmentId
                    )
                ).toBe(35);
            }
        );
    }
);

describe(
    '11.2.3 Integration Test: Update Rubrics of Previously Published Assessment',
    () => {
        test(
            'updates only rubrics and preserves weight',
            async () => {
                if (!historicalSemesterId) {
                    throw new Error(
                        'Test database needs the same band in at least two semesters'
                    );
                }

                const assessment =
                    await insertTestAssessment({
                        band: semesterBand.band,
                        semesterBandId:
                            semesterBand.semesterBandId,
                        rubrics:
                            `${TEST_MARKER}_HISTORICAL`
                    });

                track(assessment.assessmentId);

                await setWeight(
                    assessment.assessmentId,
                    40
                );

                await publishForTest(
                    assessment.assessmentId,
                    historicalSemesterId
                );

                const payload = buildEditPayload(
                    assessment,
                    {
                        rubrics:
                            `${TEST_MARKER}_HISTORICAL_UPDATED`
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
                    `SELECT assessmentType,
                            component,
                            band,
                            passingMark,
                            totalMark,
                            rubrics
                     FROM assessment
                     WHERE assessmentId = ?`,
                    [assessment.assessmentId]
                );

                expect(updated.assessmentType)
                    .toBe(assessment.assessmentType);

                expect(updated.component)
                    .toBe(assessment.component);

                expect(updated.band)
                    .toBe(assessment.band);

                expect(Number(updated.passingMark))
                    .toBe(
                        Number(assessment.passingMark)
                    );

                expect(Number(updated.totalMark))
                    .toBe(
                        Number(assessment.totalMark)
                    );

                expect(updated.rubrics).toBe(
                    `${TEST_MARKER}_HISTORICAL_UPDATED`
                );

                expect(
                    await getWeight(
                        assessment.assessmentId
                    )
                ).toBe(40);
            }
        );
    }
);

describe(
    '11.2.4 Integration Test: Reject Changes to Locked Fields',
    () => {
        test(
            'rejects a core-field change after historical publication',
            async () => {
                if (!historicalSemesterId) {
                    throw new Error(
                        'Test database needs the same band in at least two semesters'
                    );
                }

                const assessment =
                    await insertTestAssessment({
                        band: semesterBand.band,
                        semesterBandId:
                            semesterBand.semesterBandId,
                        rubrics:
                            `${TEST_MARKER}_LOCKED`
                    });

                track(assessment.assessmentId);

                await setWeight(
                    assessment.assessmentId,
                    45
                );

                await publishForTest(
                    assessment.assessmentId,
                    historicalSemesterId
                );

                const original = {
                    assessmentType:
                        assessment.assessmentType,
                    rubrics:
                        assessment.rubrics,
                    weight:
                        await getWeight(
                            assessment.assessmentId
                        )
                };

                const changedType =
                    await findUnusedAssessmentType(
                        semesterBand.band
                    );

                if (!changedType) {
                    throw new Error(
                        `No unused assessment type is available for band ${semesterBand.band}`
                    );
                }

                const res = await request(app)
                    .put(
                        `/assessments/${assessment.assessmentId}`
                    )
                    .send(
                        buildEditPayload(
                            assessment,
                            {
                                assessmentType:
                                    changedType,
                                rubrics:
                                    `${TEST_MARKER}_SHOULD_NOT_SAVE`
                            }
                        )
                    );

                expect(res.status).toBe(409);

                expect(res.body).toEqual({
                    message:
                        'This assessment has been published before: only rubrics can be changed'
                });

                const [[unchanged]] =
                    await pool.query(
                        `SELECT assessmentType, rubrics
                         FROM assessment
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                expect(unchanged.assessmentType)
                    .toBe(original.assessmentType);

                expect(unchanged.rubrics)
                    .toBe(original.rubrics);

                expect(
                    await getWeight(
                        assessment.assessmentId
                    )
                ).toBe(original.weight);
            }
        );
    }
);

describe(
    '11.2.5 Integration Test: Reject Editing Assessment Published This Semester',
    () => {
        test(
            'rejects every edit when published in selected semester',
            async () => {
                const assessment =
                    await insertTestAssessment({
                        band: semesterBand.band,
                        semesterBandId:
                            semesterBand.semesterBandId,
                        rubrics:
                            `${TEST_MARKER}_CURRENT`
                    });

                track(assessment.assessmentId);

                await setWeight(
                    assessment.assessmentId,
                    30
                );

                await publishForTest(
                    assessment.assessmentId,
                    semesterBand.semesterId
                );

                const originalWeight =
                    await getWeight(
                        assessment.assessmentId
                    );

                const res = await request(app)
                    .put(
                        `/assessments/${assessment.assessmentId}`
                    )
                    .send(
                        buildEditPayload(
                            assessment,
                            {
                                rubrics:
                                    `${TEST_MARKER}_CURRENT_CHANGED`
                            }
                        )
                    );

                expect(res.status).toBe(409);

                expect(res.body).toEqual({
                    message:
                        'Cannot edit: this assessment has already been published for this semester'
                });

                const [[unchanged]] =
                    await pool.query(
                        `SELECT rubrics
                         FROM assessment
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                expect(unchanged.rubrics)
                    .toBe(assessment.rubrics);

                expect(
                    await getWeight(
                        assessment.assessmentId
                    )
                ).toBe(originalWeight);
            }
        );
    }
);

describe(
    '11.2.6 Integration Test: Reject Duplicate Assessment Type During Edit',
    () => {
        test(
            'retains both original assessment types',
            async () => {
                const first =
                    await insertTestAssessment({
                        band: semesterBand.band,
                        semesterBandId:
                            semesterBand.semesterBandId,
                        rubrics:
                            `${TEST_MARKER}_DUPLICATE_ONE`
                    });

                track(first.assessmentId);

                const second =
                    await insertTestAssessment({
                        band: semesterBand.band,
                        semesterBandId:
                            semesterBand.semesterBandId,
                        rubrics:
                            `${TEST_MARKER}_DUPLICATE_TWO`
                    });

                track(second.assessmentId);

                expect(first.assessmentType)
                    .not.toBe(second.assessmentType);

                const res = await request(app)
                    .put(
                        `/assessments/${first.assessmentId}`
                    )
                    .send(
                        buildEditPayload(
                            first,
                            {
                                assessmentType:
                                    second.assessmentType
                            }
                        )
                    );

                expect(res.status).toBe(409);

                expect(res.body).toEqual({
                    message:
                        'Assessment type already exists for this band'
                });

                const [rows] = await pool.query(
                    `SELECT assessmentId,
                            assessmentType
                     FROM assessment
                     WHERE assessmentId IN (?, ?)
                     ORDER BY assessmentId`,
                    [
                        first.assessmentId,
                        second.assessmentId
                    ]
                );

                expect(rows).toHaveLength(2);

                const firstRow = rows.find(
                    row =>
                        Number(row.assessmentId) ===
                        Number(first.assessmentId)
                );

                const secondRow = rows.find(
                    row =>
                        Number(row.assessmentId) ===
                        Number(second.assessmentId)
                );

                expect(firstRow.assessmentType)
                    .toBe(first.assessmentType);

                expect(secondRow.assessmentType)
                    .toBe(second.assessmentType);
            }
        );
    }
);

describe(
    '11.2.7 Integration Test: Reject Nonexistent Assessment',
    () => {
        test(
            'returns 404 and leaves database unchanged',
            async () => {
                const assessmentType =
                    await findUnusedAssessmentType(
                        semesterBand.band
                    );

                if (!assessmentType) {
                    throw new Error(
                        `No unused assessment type is available for band ${semesterBand.band}`
                    );
                }

                const fakeAssessment = {
                    assessmentType,
                    component: 'Vocabulary',
                    band: semesterBand.band,
                    passingMark: 50,
                    totalMark: 100,
                    rubrics: TEST_MARKER
                };

                const [[{ beforeCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS beforeCount
                         FROM assessment`
                    );

                const res = await request(app)
                    .put('/assessments/999999999')
                    .send(
                        buildEditPayload(
                            fakeAssessment
                        )
                    );

                expect(res.status).toBe(404);

                expect(res.body).toEqual({
                    message: 'Assessment not found'
                });

                const [[{ afterCount }]] =
                    await pool.query(
                        `SELECT COUNT(*) AS afterCount
                         FROM assessment`
                    );

                expect(Number(afterCount))
                    .toBe(Number(beforeCount));
            }
        );
    }
);

describe(
    '11.2.8 Integration Test: Reject Missing Semester Band',
    () => {
        test(
            'returns 404 and rolls back the edit',
            async () => {
                const assessment =
                    await insertTestAssessment({
                        band: semesterBand.band,
                        semesterBandId:
                            semesterBand.semesterBandId,
                        rubrics:
                            `${TEST_MARKER}_NO_SEMBAND`
                    });

                track(assessment.assessmentId);

                const originalRubrics =
                    assessment.rubrics;

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
                            semesterBand.band
                        ]
                    );

                expect(Number(matchCount)).toBe(0);

                const res = await request(app)
                    .put(
                        `/assessments/${assessment.assessmentId}`
                    )
                    .send(
                        buildEditPayload(
                            assessment,
                            {
                                semesterId:
                                    nonexistentSemesterId,
                                rubrics:
                                    `${TEST_MARKER}_SHOULD_ROLL_BACK`
                            }
                        )
                    );

                expect(res.status).toBe(404);

                expect(res.body).toEqual({
                    message:
                        'No matching band found for this semester'
                });

                const [[unchanged]] =
                    await pool.query(
                        `SELECT rubrics
                         FROM assessment
                         WHERE assessmentId = ?`,
                        [assessment.assessmentId]
                    );

                expect(unchanged.rubrics)
                    .toBe(originalRubrics);
            }
        );
    }
);

describe(
    '11.2.9 Integration Test: Reject Invalid Edit',
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
                                passingMark: 100,
                                totalMark: 99
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
                    .toBe(
                        Number(assessment.passingMark)
                    );

                expect(Number(unchanged.totalMark))
                    .toBe(
                        Number(assessment.totalMark)
                    );
            }
        );
    }
);