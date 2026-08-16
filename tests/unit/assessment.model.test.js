jest.mock('../../models/db', () => ({
    getConnection: jest.fn(),
    query: jest.fn()
}));

const pool = require('../../models/db');

const {
    createAssessment,
    updateAssessment,
    publishAssessment,
    unpublishAssessment,
    deleteAssessment
} = require('../../models/assessment');

describe('Assessment model', () => {
    let connection;

    beforeEach(() => {
        jest.clearAllMocks();

        connection = {
            query: jest.fn(),
            beginTransaction:
                jest.fn().mockResolvedValue(),
            commit:
                jest.fn().mockResolvedValue(),
            rollback:
                jest.fn().mockResolvedValue(),
            release: jest.fn()
        };

        pool.getConnection.mockResolvedValue(connection);
    });

    describe('createAssessment', () => {
        const data = {
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'A1',
            passingMark: 50,
            totalMark: 100,
            rubrics: 'Read each word clearly.'
        };

        test('creates assessment with initial weight zero', async () => {
            connection.query
                .mockResolvedValueOnce([
                    [{ dupCount: 0 }]
                ])
                .mockResolvedValueOnce([
                    { insertId: 15 }
                ])
                .mockResolvedValueOnce([
                    [{
                        semesterBandId:
                            'band-a1-2022-s1'
                    }]
                ])
                .mockResolvedValueOnce([
                    { affectedRows: 1 }
                ]);

            const result = await createAssessment(
                data,
                202201
            );

            expect(result).toEqual({
                success: true,
                assessmentId: 15
            });

            expect(connection.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    'INSERT INTO assessment'
                ),
                [
                    'Fluency',
                    'Vocabulary',
                    'A1',
                    50,
                    100,
                    'Read each word clearly.'
                ]
            );

            expect(connection.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    'INSERT INTO semesterBandAssessmentWeight'
                ),
                [
                    'band-a1-2022-s1',
                    15,
                    0
                ]
            );

            expect(
                connection.commit
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.rollback
            ).not.toHaveBeenCalled();

            expect(
                connection.release
            ).toHaveBeenCalledTimes(1);
        });

        test('rejects duplicate assessment type', async () => {
            connection.query.mockResolvedValueOnce([
                [{ dupCount: 1 }]
            ]);

            const result = await createAssessment(
                data,
                202201
            );

            expect(result).toEqual({
                success: false,
                reason: 'DUPLICATE_ASSESSMENT_TYPE'
            });

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.commit
            ).not.toHaveBeenCalled();

            expect(
                connection.release
            ).toHaveBeenCalledTimes(1);
        });

        test('rolls back when semester band is absent', async () => {
            connection.query
                .mockResolvedValueOnce([
                    [{ dupCount: 0 }]
                ])
                .mockResolvedValueOnce([
                    { insertId: 15 }
                ])
                .mockResolvedValueOnce([[]]);

            const result = await createAssessment(
                data,
                209901
            );

            expect(result).toEqual({
                success: false,
                reason: 'SEMESTER_BAND_NOT_FOUND'
            });

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.commit
            ).not.toHaveBeenCalled();
        });

        test('rolls back when weight row cannot be created', async () => {
            connection.query
                .mockResolvedValueOnce([
                    [{ dupCount: 0 }]
                ])
                .mockResolvedValueOnce([
                    { insertId: 15 }
                ])
                .mockResolvedValueOnce([
                    [{
                        semesterBandId:
                            'band-a1-2022-s1'
                    }]
                ])
                .mockResolvedValueOnce([
                    { affectedRows: 0 }
                ]);

            const result = await createAssessment(
                data,
                202201
            );

            expect(result).toEqual({
                success: false,
                reason: 'WEIGHT_CREATION_FAILED'
            });

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.commit
            ).not.toHaveBeenCalled();
        });

        test('rolls back and rethrows database errors', async () => {
            connection.query.mockRejectedValueOnce(
                new Error('Database insert failed')
            );

            await expect(
                createAssessment(data, 202201)
            ).rejects.toThrow(
                'Database insert failed'
            );

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.commit
            ).not.toHaveBeenCalled();

            expect(
                connection.release
            ).toHaveBeenCalledTimes(1);
        });
    });

    describe('updateAssessment', () => {
        const storedAssessment = {
            assessmentId: 15,
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'A1',
            passingMark: 50,
            totalMark: 100,
            rubrics: 'Original rubric.'
        };

        const data = {
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'A1',
            passingMark: 50,
            totalMark: 100,
            rubrics: 'Updated rubric.'
        };

        function mockCommonUpdateState({
            publishedThisSemester = 0,
            publishedAnywhere = 0,
            semesterBandId =
                'band-a1-2022-s1'
        } = {}) {
            connection.query
                .mockResolvedValueOnce([
                    [storedAssessment]
                ])
                .mockResolvedValueOnce([
                    [{ publishedThisSemester }]
                ]);

            if (publishedThisSemester === 0) {
                connection.query
                    .mockResolvedValueOnce([
                        [{ publishedAnywhere }]
                    ])
                    .mockResolvedValueOnce(
                        semesterBandId
                            ? [[{ semesterBandId }]]
                            : [[]]
                    );
            }
        }

        test('returns NOT_FOUND for absent assessment', async () => {
            connection.query.mockResolvedValueOnce([[]]);

            const result = await updateAssessment(
                99999,
                data,
                202201
            );

            expect(result).toEqual({
                success: false,
                reason: 'NOT_FOUND'
            });

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.release
            ).toHaveBeenCalledTimes(1);
        });

        test('rejects assessment published this semester', async () => {
            mockCommonUpdateState({
                publishedThisSemester: 1
            });

            const result = await updateAssessment(
                15,
                data,
                202201
            );

            expect(result).toEqual({
                success: false,
                reason: 'ALREADY_PUBLISHED'
            });

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.commit
            ).not.toHaveBeenCalled();
        });

        test('returns SEMESTER_BAND_NOT_FOUND', async () => {
            mockCommonUpdateState({
                semesterBandId: null
            });

            const result = await updateAssessment(
                15,
                data,
                209901
            );

            expect(result).toEqual({
                success: false,
                reason: 'SEMESTER_BAND_NOT_FOUND'
            });

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);
        });

        test.each([
            [
                'assessmentType',
                'Comprehension'
            ],
            [
                'component',
                'Writing'
            ],
            [
                'band',
                'A2'
            ],
            [
                'passingMark',
                60
            ],
            [
                'totalMark',
                90
            ]
        ])(
            'locks changed core field %s after publication',
            async (field, value) => {
                mockCommonUpdateState({
                    publishedAnywhere: 1
                });

                const result = await updateAssessment(
                    15,
                    {
                        ...data,
                        [field]: value
                    },
                    202201
                );

                expect(result).toEqual({
                    success: false,
                    reason: 'LOCKED_FIELDS'
                });

                expect(
                    connection.rollback
                ).toHaveBeenCalledTimes(1);

                expect(
                    connection.commit
                ).not.toHaveBeenCalled();
            }
        );

        test('updates only rubrics after past publication', async () => {
            mockCommonUpdateState({
                publishedAnywhere: 1
            });

            connection.query.mockResolvedValueOnce([
                { affectedRows: 1 }
            ]);

            const result = await updateAssessment(
                15,
                data,
                202201
            );

            expect(result).toEqual({
                success: true
            });

            expect(connection.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    'UPDATE assessment SET rubrics'
                ),
                [
                    'Updated rubric.',
                    15
                ]
            );

            expect(
                connection.commit
            ).toHaveBeenCalledTimes(1);
        });

        test('rejects duplicate type for unpublished assessment', async () => {
            mockCommonUpdateState({
                publishedAnywhere: 0
            });

            connection.query.mockResolvedValueOnce([
                [{ dupCount: 1 }]
            ]);

            const result = await updateAssessment(
                15,
                {
                    ...data,
                    assessmentType: 'Comprehension'
                },
                202201
            );

            expect(result).toEqual({
                success: false,
                reason: 'DUPLICATE_ASSESSMENT_TYPE'
            });

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);
        });

        test('updates an unpublished assessment', async () => {
            mockCommonUpdateState({
                publishedAnywhere: 0
            });

            connection.query
                .mockResolvedValueOnce([
                    [{ dupCount: 0 }]
                ])
                .mockResolvedValueOnce([
                    { affectedRows: 1 }
                ]);

            const result = await updateAssessment(
                15,
                {
                    ...data,
                    passingMark: 60
                },
                202201
            );

            expect(result).toEqual({
                success: true
            });

            expect(connection.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    'UPDATE assessment SET assessmentType'
                ),
                [
                    'Fluency',
                    'Vocabulary',
                    'A1',
                    60,
                    100,
                    'Updated rubric.',
                    15
                ]
            );

            expect(
                connection.commit
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.rollback
            ).not.toHaveBeenCalled();

            expect(
                connection.release
            ).toHaveBeenCalledTimes(1);
        });

        test('rolls back and rethrows update error', async () => {
            mockCommonUpdateState({
                publishedAnywhere: 0
            });

            connection.query
                .mockResolvedValueOnce([
                    [{ dupCount: 0 }]
                ])
                .mockRejectedValueOnce(
                    new Error('Database update failed')
                );

            await expect(
                updateAssessment(
                    15,
                    data,
                    202201
                )
            ).rejects.toThrow(
                'Database update failed'
            );

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.commit
            ).not.toHaveBeenCalled();

            expect(
                connection.release
            ).toHaveBeenCalledTimes(1);
        });
    });

    describe('publishAssessment', () => {
        test('returns NOT_FOUND', async () => {
            connection.query.mockResolvedValueOnce([[]]);

            const result = await publishAssessment(
                99999,
                202201,
                '2026-09-30'
            );

            expect(result).toEqual({
                success: false,
                reason: 'NOT_FOUND'
            });

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);
        });

        test('returns ALREADY_PUBLISHED at count one', async () => {
            connection.query
                .mockResolvedValueOnce([
                    [{ band: 'A1' }]
                ])
                .mockResolvedValueOnce([
                    [{ existingCount: 1 }]
                ]);

            const result = await publishAssessment(
                15,
                202201,
                '2026-09-30'
            );

            expect(result).toEqual({
                success: false,
                reason: 'ALREADY_PUBLISHED'
            });

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);
        });

        test('returns NO_STUDENTS for empty band', async () => {
            connection.query
                .mockResolvedValueOnce([
                    [{ band: 'A1' }]
                ])
                .mockResolvedValueOnce([
                    [{ existingCount: 0 }]
                ])
                .mockResolvedValueOnce([[]]);

            const result = await publishAssessment(
                15,
                202201,
                '2026-09-30'
            );

            expect(result).toEqual({
                success: false,
                reason: 'NO_STUDENTS'
            });

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);
        });

        test('publishes to one student at boundary', async () => {
            connection.query
                .mockResolvedValueOnce([
                    [{ band: 'A1' }]
                ])
                .mockResolvedValueOnce([
                    [{ existingCount: 0 }]
                ])
                .mockResolvedValueOnce([
                    [{ studentId: 101 }]
                ])
                .mockResolvedValueOnce([
                    { affectedRows: 1 }
                ]);

            const result = await publishAssessment(
                15,
                202201,
                '2026-09-30'
            );

            expect(result).toEqual({
                success: true,
                studentsAssigned: 1
            });

            expect(connection.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    'INSERT INTO studentAssessment'
                ),
                [[
                    [
                        101,
                        15,
                        202201,
                        'Assigned',
                        '2026-09-30'
                    ]
                ]]
            );

            expect(
                connection.commit
            ).toHaveBeenCalledTimes(1);
        });

        test('publishes to 24 students', async () => {
            const students = Array.from(
                { length: 24 },
                (_, index) => ({
                    studentId: index + 101
                })
            );

            connection.query
                .mockResolvedValueOnce([
                    [{ band: 'A1' }]
                ])
                .mockResolvedValueOnce([
                    [{ existingCount: 0 }]
                ])
                .mockResolvedValueOnce([
                    students
                ])
                .mockResolvedValueOnce([
                    { affectedRows: 24 }
                ]);

            const result = await publishAssessment(
                15,
                202201,
                '2026-09-30'
            );

            expect(result).toEqual({
                success: true,
                studentsAssigned: 24
            });

            const insertCall =
                connection.query.mock.calls.find(
                    ([sql]) =>
                        sql.includes(
                            'INSERT INTO studentAssessment'
                        )
                );

            expect(insertCall[1][0]).toHaveLength(24);

            expect(
                connection.commit
            ).toHaveBeenCalledTimes(1);
        });

        test('rolls back when assignment insert fails', async () => {
            connection.query
                .mockResolvedValueOnce([
                    [{ band: 'A1' }]
                ])
                .mockResolvedValueOnce([
                    [{ existingCount: 0 }]
                ])
                .mockResolvedValueOnce([
                    [{ studentId: 101 }]
                ])
                .mockRejectedValueOnce(
                    new Error('Assignment insert failed')
                );

            await expect(
                publishAssessment(
                    15,
                    202201,
                    '2026-09-30'
                )
            ).rejects.toThrow(
                'Assignment insert failed'
            );

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.commit
            ).not.toHaveBeenCalled();

            expect(
                connection.release
            ).toHaveBeenCalledTimes(1);
        });
    });

    describe('unpublishAssessment', () => {
        test('returns NOT_PUBLISHED when count is zero', async () => {
            connection.query.mockResolvedValueOnce([
                [{ existingCount: 0 }]
            ]);

            const result = await unpublishAssessment(
                15,
                202201
            );

            expect(result).toEqual({
                success: false,
                reason: 'NOT_PUBLISHED'
            });

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);
        });

        test.each([
            [1, 1],
            [24, 5]
        ])(
            'rejects %i assignments with %i submissions',
            async (existingCount, submittedCount) => {
                connection.query
                    .mockResolvedValueOnce([
                        [{ existingCount }]
                    ])
                    .mockResolvedValueOnce([
                        [{ submittedCount }]
                    ]);

                const result =
                    await unpublishAssessment(
                        15,
                        202201
                    );

                expect(result).toEqual({
                    success: false,
                    reason: 'HAS_SUBMISSIONS'
                });

                expect(
                    connection.rollback
                ).toHaveBeenCalledTimes(1);

                expect(
                    connection.commit
                ).not.toHaveBeenCalled();
            }
        );

        test.each([
            [1],
            [24]
        ])(
            'deletes %i unsubmitted assignments',
            async existingCount => {
                connection.query
                    .mockResolvedValueOnce([
                        [{ existingCount }]
                    ])
                    .mockResolvedValueOnce([
                        [{ submittedCount: 0 }]
                    ])
                    .mockResolvedValueOnce([
                        { affectedRows: existingCount }
                    ]);

                const result =
                    await unpublishAssessment(
                        15,
                        202201
                    );

                expect(result).toEqual({
                    success: true
                });

                expect(connection.query)
                    .toHaveBeenCalledWith(
                        expect.stringContaining(
                            'DELETE FROM studentAssessment'
                        ),
                        [15, 202201]
                    );

                expect(
                    connection.commit
                ).toHaveBeenCalledTimes(1);

                expect(
                    connection.rollback
                ).not.toHaveBeenCalled();
            }
        );

        test('rolls back when unpublish delete fails', async () => {
            connection.query
                .mockResolvedValueOnce([
                    [{ existingCount: 1 }]
                ])
                .mockResolvedValueOnce([
                    [{ submittedCount: 0 }]
                ])
                .mockRejectedValueOnce(
                    new Error('Database delete failed')
                );

            await expect(
                unpublishAssessment(15, 202201)
            ).rejects.toThrow(
                'Database delete failed'
            );

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.commit
            ).not.toHaveBeenCalled();

            expect(
                connection.release
            ).toHaveBeenCalledTimes(1);
        });
    });

    describe('deleteAssessment', () => {
        test('returns NOT_FOUND for missing assessment', async () => {
            connection.query.mockResolvedValueOnce([[]]);

            const result = await deleteAssessment(99999);

            expect(result).toEqual({
                success: false,
                reason: 'NOT_FOUND'
            });

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);
        });

        test.each([
            [1],
            [3]
        ])(
            'rejects publishedCount %i',
            async publishedCount => {
                connection.query
                    .mockResolvedValueOnce([
                        [{ assessmentId: 15 }]
                    ])
                    .mockResolvedValueOnce([
                        [{ publishedCount }]
                    ]);

                const result =
                    await deleteAssessment(15);

                expect(result).toEqual({
                    success: false,
                    reason: 'ALREADY_PUBLISHED'
                });

                expect(
                    connection.rollback
                ).toHaveBeenCalledTimes(1);

                expect(
                    connection.commit
                ).not.toHaveBeenCalled();
            }
        );

        test('deletes unpublished assessment atomically', async () => {
            connection.query
                .mockResolvedValueOnce([
                    [{ assessmentId: 15 }]
                ])
                .mockResolvedValueOnce([
                    [{ publishedCount: 0 }]
                ])
                .mockResolvedValueOnce([
                    { affectedRows: 1 }
                ])
                .mockResolvedValueOnce([
                    { affectedRows: 1 }
                ]);

            const result = await deleteAssessment(15);

            expect(result).toEqual({
                success: true
            });

            expect(connection.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    'DELETE FROM semesterBandAssessmentWeight'
                ),
                [15]
            );

            expect(connection.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    'DELETE FROM assessment'
                ),
                [15]
            );

            expect(
                connection.commit
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.rollback
            ).not.toHaveBeenCalled();

            expect(
                connection.release
            ).toHaveBeenCalledTimes(1);
        });

        test('rolls back when weight deletion fails', async () => {
            connection.query
                .mockResolvedValueOnce([
                    [{ assessmentId: 15 }]
                ])
                .mockResolvedValueOnce([
                    [{ publishedCount: 0 }]
                ])
                .mockRejectedValueOnce(
                    new Error('Weight deletion failed')
                );

            await expect(
                deleteAssessment(15)
            ).rejects.toThrow(
                'Weight deletion failed'
            );

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.commit
            ).not.toHaveBeenCalled();
        });

        test('rolls back successful weight deletion when assessment deletion fails', async () => {
            connection.query
                .mockResolvedValueOnce([
                    [{ assessmentId: 15 }]
                ])
                .mockResolvedValueOnce([
                    [{ publishedCount: 0 }]
                ])
                .mockResolvedValueOnce([
                    { affectedRows: 1 }
                ])
                .mockRejectedValueOnce(
                    new Error('Assessment deletion failed')
                );

            await expect(
                deleteAssessment(15)
            ).rejects.toThrow(
                'Assessment deletion failed'
            );

            expect(
                connection.rollback
            ).toHaveBeenCalledTimes(1);

            expect(
                connection.commit
            ).not.toHaveBeenCalled();

            expect(
                connection.release
            ).toHaveBeenCalledTimes(1);
        });
    });
});