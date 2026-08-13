jest.mock('../../models/db', () => ({
    getConnection: jest.fn(),
    query: jest.fn()
}));

const pool = require('../../models/db');
const {
    getSemAndBandBySemBandId,
    createAssessment,
    updateAssessment,
    getAssessmentById,
    getAllAssessmentsFiltered,
    deleteAssessment,
    publishAssessment,
    unpublishAssessment
} = require('../../models/assessment');

describe('Assessment Model', () => {
    let connection;

    const assessmentData = {
        assessmentType: 'Fluency',
        component: 'Vocabulary',
        band: 'A1',
        passingMark: 50,
        totalMark: 100,
        rubrics: 'Test rubric'
    };

    const existingAssessment = {
        assessmentId: 10,
        assessmentType: 'Fluency',
        component: 'Vocabulary',
        band: 'A1',
        passingMark: 50,
        totalMark: 100,
        rubrics: 'Old rubric'
    };

    beforeEach(() => {
        jest.clearAllMocks();

        connection = {
            query: jest.fn(),
            beginTransaction: jest.fn().mockResolvedValue(undefined),
            commit: jest.fn().mockResolvedValue(undefined),
            rollback: jest.fn().mockResolvedValue(undefined),
            release: jest.fn()
        };

        pool.getConnection.mockResolvedValue(connection);
    });

    function expectCommitted() {
        expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
        expect(connection.commit).toHaveBeenCalledTimes(1);
        expect(connection.rollback).not.toHaveBeenCalled();
        expect(connection.release).toHaveBeenCalledTimes(1);
    }

    function expectRolledBack() {
        expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
        expect(connection.rollback).toHaveBeenCalledTimes(1);
        expect(connection.commit).not.toHaveBeenCalled();
        expect(connection.release).toHaveBeenCalledTimes(1);
    }

    describe('getSemAndBandBySemBandId', () => {
        test('returns the semester and band when the semester band exists', async () => {
            pool.query.mockResolvedValueOnce([[
                { semesterId: 202201, band: 'A1' }
            ]]);

            const result = await getSemAndBandBySemBandId(
                'band-a1-2022-s1'
            );

            expect(result).toEqual({ semesterId: 202201, band: 'A1' });
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('FROM semesterBand'),
                ['band-a1-2022-s1']
            );
        });

        test('returns null when the semester band does not exist', async () => {
            pool.query.mockResolvedValueOnce([[]]);

            await expect(
                getSemAndBandBySemBandId('missing-band')
            ).resolves.toBeNull();
        });

        test('propagates database errors', async () => {
            pool.query.mockRejectedValueOnce(new Error('Database failure'));

            await expect(
                getSemAndBandBySemBandId('band-a1-2022-s1')
            ).rejects.toThrow('Database failure');
        });
    });

    describe('createAssessment', () => {
        test('creates an assessment and initial weight successfully', async () => {
            connection.query
                .mockResolvedValueOnce([[{ dupCount: 0 }]])
                .mockResolvedValueOnce([{ insertId: 10 }])
                .mockResolvedValueOnce([[
                    { semesterBandId: 'band-a1-2022-s1' }
                ]])
                .mockResolvedValueOnce([{ affectedRows: 1 }]);

            const result = await createAssessment(
                assessmentData,
                202201,
                0
            );

            expect(result).toEqual({ success: true, assessmentId: 10 });
            expect(connection.query).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining('SELECT COUNT(*) AS dupCount'),
                ['A1', 'Fluency']
            );
            expect(connection.query).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining('INSERT INTO assessment'),
                ['Fluency', 'Vocabulary', 'A1', 50, 100, 'Test rubric']
            );
            expect(connection.query).toHaveBeenNthCalledWith(
                3,
                expect.stringContaining('FROM semesterBand'),
                [202201, 'A1']
            );
            expect(connection.query).toHaveBeenNthCalledWith(
                4,
                expect.stringContaining(
                    'INSERT INTO semesterBandAssessmentWeight'
                ),
                ['band-a1-2022-s1', 10, 0]
            );
            expectCommitted();
        });

        test('rejects a duplicate assessment type in the same band', async () => {
            connection.query.mockResolvedValueOnce([[{ dupCount: 1 }]]);

            const result = await createAssessment(
                assessmentData,
                202201,
                0
            );

            expect(result).toEqual({
                success: false,
                reason: 'DUPLICATE_ASSESSMENT_TYPE'
            });
            expect(connection.query).toHaveBeenCalledTimes(1);
            expectRolledBack();
        });

        test('rolls back when the semester band cannot be found', async () => {
            connection.query
                .mockResolvedValueOnce([[{ dupCount: 0 }]])
                .mockResolvedValueOnce([{ insertId: 10 }])
                .mockResolvedValueOnce([[]]);

            const result = await createAssessment(
                assessmentData,
                999999,
                0
            );

            expect(result).toEqual({
                success: false,
                reason: 'SEMESTER_BAND_NOT_FOUND'
            });
            expect(connection.query).toHaveBeenCalledTimes(3);
            expectRolledBack();
        });

        test('rolls back when the weight row is not created', async () => {
            connection.query
                .mockResolvedValueOnce([[{ dupCount: 0 }]])
                .mockResolvedValueOnce([{ insertId: 10 }])
                .mockResolvedValueOnce([[
                    { semesterBandId: 'band-a1-2022-s1' }
                ]])
                .mockResolvedValueOnce([{ affectedRows: 0 }]);

            const result = await createAssessment(
                assessmentData,
                202201,
                0
            );

            expect(result).toEqual({
                success: false,
                reason: 'WEIGHT_CREATION_FAILED'
            });
            expectRolledBack();
        });

        test('rolls back, releases the connection and rethrows errors', async () => {
            connection.query.mockRejectedValueOnce(
                new Error('Database failure')
            );

            await expect(
                createAssessment(assessmentData, 202201, 0)
            ).rejects.toThrow('Database failure');

            expectRolledBack();
        });
    });

    describe('updateAssessment', () => {
        test('updates all fields for an assessment that was never published', async () => {
            connection.query
                .mockResolvedValueOnce([[existingAssessment]])
                .mockResolvedValueOnce([[{ publishedThisSemester: 0 }]])
                .mockResolvedValueOnce([[{ publishedAnywhere: 0 }]])
                .mockResolvedValueOnce([[
                    { semesterBandId: 'band-a1-2022-s1' }
                ]])
                .mockResolvedValueOnce([[{ dupCount: 0 }]])
                .mockResolvedValueOnce([{ affectedRows: 1 }])
                .mockResolvedValueOnce([{ affectedRows: 1 }]);

            const result = await updateAssessment(
                10,
                { ...assessmentData, rubrics: 'Updated rubric' },
                202201,
                0
            );

            expect(result).toEqual({ success: true });
            expect(connection.query).toHaveBeenNthCalledWith(
                6,
                expect.stringContaining('UPDATE assessment SET'),
                [
                    'Fluency',
                    'Vocabulary',
                    'A1',
                    50,
                    100,
                    'Updated rubric',
                    10
                ]
            );
            expect(connection.query).toHaveBeenNthCalledWith(
                7,
                expect.stringContaining('ON DUPLICATE KEY UPDATE'),
                ['band-a1-2022-s1', 10, 0]
            );
            expectCommitted();
        });

        test('returns NOT_FOUND when the assessment does not exist', async () => {
            connection.query.mockResolvedValueOnce([[]]);

            const result = await updateAssessment(
                999,
                assessmentData,
                202201,
                0
            );

            expect(result).toEqual({ success: false, reason: 'NOT_FOUND' });
            expect(connection.query).toHaveBeenCalledTimes(1);
            expectRolledBack();
        });

        test('rejects an assessment already published this semester', async () => {
            connection.query
                .mockResolvedValueOnce([[existingAssessment]])
                .mockResolvedValueOnce([[{ publishedThisSemester: 1 }]]);

            const result = await updateAssessment(
                10,
                assessmentData,
                202201,
                0
            );

            expect(result).toEqual({
                success: false,
                reason: 'ALREADY_PUBLISHED'
            });
            expect(connection.query).toHaveBeenCalledTimes(2);
            expectRolledBack();
        });

        test('rejects an update when its semester band does not exist', async () => {
            connection.query
                .mockResolvedValueOnce([[existingAssessment]])
                .mockResolvedValueOnce([[{ publishedThisSemester: 0 }]])
                .mockResolvedValueOnce([[{ publishedAnywhere: 0 }]])
                .mockResolvedValueOnce([[]]);

            const result = await updateAssessment(
                10,
                assessmentData,
                999999,
                0
            );

            expect(result).toEqual({
                success: false,
                reason: 'SEMESTER_BAND_NOT_FOUND'
            });
            expectRolledBack();
        });

        test('updates only rubrics and weight if published in a past semester', async () => {
            connection.query
                .mockResolvedValueOnce([[existingAssessment]])
                .mockResolvedValueOnce([[{ publishedThisSemester: 0 }]])
                .mockResolvedValueOnce([[{ publishedAnywhere: 1 }]])
                .mockResolvedValueOnce([[
                    { semesterBandId: 'band-a1-2022-s1' }
                ]])
                .mockResolvedValueOnce([{ affectedRows: 1 }])
                .mockResolvedValueOnce([{ affectedRows: 1 }]);

            const result = await updateAssessment(
                10,
                { ...assessmentData, rubrics: 'Updated rubric' },
                202201,
                0
            );

            expect(result).toEqual({ success: true });
            expect(connection.query).toHaveBeenNthCalledWith(
                5,
                expect.stringContaining(
                    'UPDATE assessment SET rubrics = ?'
                ),
                ['Updated rubric', 10]
            );
            expect(connection.query).toHaveBeenNthCalledWith(
                6,
                expect.stringContaining('ON DUPLICATE KEY UPDATE'),
                ['band-a1-2022-s1', 10, 0]
            );
            expectCommitted();
        });

        test.each([
            ['assessment type', { assessmentType: 'Phonics' }],
            ['component', { component: 'Writing' }],
            ['band', { band: 'A2' }],
            ['passing mark', { passingMark: 60 }],
            ['total mark', { totalMark: 120 }]
        ])(
            'rejects a changed locked %s after past publication',
            async (_field, change) => {
                connection.query
                    .mockResolvedValueOnce([[existingAssessment]])
                    .mockResolvedValueOnce([[
                        { publishedThisSemester: 0 }
                    ]])
                    .mockResolvedValueOnce([[{ publishedAnywhere: 1 }]])
                    .mockResolvedValueOnce([[
                        { semesterBandId: 'band-a1-2022-s1' }
                    ]]);

                const result = await updateAssessment(
                    10,
                    { ...assessmentData, ...change },
                    202201,
                    0
                );

                expect(result).toEqual({
                    success: false,
                    reason: 'LOCKED_FIELDS'
                });
                expect(connection.query).toHaveBeenCalledTimes(4);
                expectRolledBack();
            }
        );

        test('compares numeric marks by value instead of type', async () => {
            connection.query
                .mockResolvedValueOnce([[existingAssessment]])
                .mockResolvedValueOnce([[{ publishedThisSemester: 0 }]])
                .mockResolvedValueOnce([[{ publishedAnywhere: 1 }]])
                .mockResolvedValueOnce([[
                    { semesterBandId: 'band-a1-2022-s1' }
                ]])
                .mockResolvedValueOnce([{ affectedRows: 1 }])
                .mockResolvedValueOnce([{ affectedRows: 1 }]);

            const result = await updateAssessment(
                10,
                {
                    ...assessmentData,
                    passingMark: '50',
                    totalMark: '100'
                },
                202201,
                0
            );

            expect(result).toEqual({ success: true });
            expectCommitted();
        });

        test('rejects a duplicate type when updating an unpublished assessment', async () => {
            connection.query
                .mockResolvedValueOnce([[existingAssessment]])
                .mockResolvedValueOnce([[{ publishedThisSemester: 0 }]])
                .mockResolvedValueOnce([[{ publishedAnywhere: 0 }]])
                .mockResolvedValueOnce([[
                    { semesterBandId: 'band-a1-2022-s1' }
                ]])
                .mockResolvedValueOnce([[{ dupCount: 1 }]]);

            const result = await updateAssessment(
                10,
                assessmentData,
                202201,
                0
            );

            expect(result).toEqual({
                success: false,
                reason: 'DUPLICATE_ASSESSMENT_TYPE'
            });
            expect(connection.query).toHaveBeenCalledTimes(5);
            expectRolledBack();
        });

        test('rolls back, releases and rethrows database errors', async () => {
            connection.query.mockRejectedValueOnce(
                new Error('Database failure')
            );

            await expect(
                updateAssessment(10, assessmentData, 202201, 0)
            ).rejects.toThrow('Database failure');

            expectRolledBack();
        });
    });

    describe('getAssessmentById', () => {
        test('returns an assessment when found', async () => {
            pool.query.mockResolvedValueOnce([[existingAssessment]]);

            await expect(getAssessmentById(10)).resolves.toEqual(
                existingAssessment
            );
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE assessmentId = ?'),
                [10]
            );
        });

        test('returns null when no assessment is found', async () => {
            pool.query.mockResolvedValueOnce([[]]);

            await expect(getAssessmentById(999)).resolves.toBeNull();
        });

        test('propagates database errors', async () => {
            pool.query.mockRejectedValueOnce(new Error('Database failure'));

            await expect(getAssessmentById(10)).rejects.toThrow(
                'Database failure'
            );
        });
    });

    describe('getAllAssessmentsFiltered', () => {
        const rows = [existingAssessment];

        test.each([
            ['no optional filters', [202201, null, null, null], [202201, 202201]],
            ['assessment type', [202201, 'Fluency', null, null], [202201, 202201, 'Fluency']],
            ['component', [202201, null, 'Vocabulary', null], [202201, 202201, '%Vocabulary%']],
            ['band', [202201, null, null, 'A1'], [202201, 202201, 'A1']],
            ['all filters', [202201, 'Fluency', 'Vocabulary', 'A1'], [202201, 202201, 'Fluency', '%Vocabulary%', 'A1']]
        ])('returns rows using %s', async (_name, args, expectedParams) => {
            pool.query.mockResolvedValueOnce([rows]);

            const result = await getAllAssessmentsFiltered(...args);
            const [sql, params] = pool.query.mock.calls[0];

            expect(result).toEqual(rows);
            expect(params).toEqual(expectedParams);
            expect(sql).toContain('GROUP BY a.assessmentId');
            expect(sql).toContain('ORDER BY a.assessmentId');

            if (args[1] !== null) {
                expect(sql).toContain('AND a.assessmentType = ?');
            }
            if (args[2] !== null) {
                expect(sql).toContain('AND a.component LIKE ?');
            }
            if (args[3] !== null) {
                expect(sql).toContain('AND a.band = ?');
            }
        });

        test('propagates database errors', async () => {
            pool.query.mockRejectedValueOnce(new Error('Database failure'));

            await expect(
                getAllAssessmentsFiltered(202201)
            ).rejects.toThrow('Database failure');
        });
    });

    describe('deleteAssessment', () => {
        test('deletes an assessment and its weight row successfully', async () => {
            connection.query
                .mockResolvedValueOnce([[{ assessmentId: 10 }]])
                .mockResolvedValueOnce([[{ publishedCount: 0 }]])
                .mockResolvedValueOnce([{ affectedRows: 1 }])
                .mockResolvedValueOnce([{ affectedRows: 1 }]);

            await expect(deleteAssessment(10)).resolves.toEqual({
                success: true
            });
            expect(connection.query).toHaveBeenNthCalledWith(
                3,
                expect.stringContaining(
                    'DELETE FROM semesterBandAssessmentWeight'
                ),
                [10]
            );
            expect(connection.query).toHaveBeenNthCalledWith(
                4,
                expect.stringContaining('DELETE FROM assessment'),
                [10]
            );
            expectCommitted();
        });

        test('returns NOT_FOUND when the assessment does not exist', async () => {
            connection.query.mockResolvedValueOnce([[]]);

            await expect(deleteAssessment(999)).resolves.toEqual({
                success: false,
                reason: 'NOT_FOUND'
            });
            expectRolledBack();
        });

        test('rejects deletion when the assessment was published', async () => {
            connection.query
                .mockResolvedValueOnce([[{ assessmentId: 10 }]])
                .mockResolvedValueOnce([[{ publishedCount: 1 }]]);

            await expect(deleteAssessment(10)).resolves.toEqual({
                success: false,
                reason: 'ALREADY_PUBLISHED'
            });
            expect(connection.query).toHaveBeenCalledTimes(2);
            expectRolledBack();
        });

        test('rolls back, releases and rethrows database errors', async () => {
            connection.query.mockRejectedValueOnce(
                new Error('Database failure')
            );

            await expect(deleteAssessment(10)).rejects.toThrow(
                'Database failure'
            );
            expectRolledBack();
        });
    });

    describe('publishAssessment', () => {
        const dueDate = '2026-08-31';

        test('assigns the assessment to every matching student', async () => {
            connection.query
                .mockResolvedValueOnce([[{ band: 'A1' }]])
                .mockResolvedValueOnce([[{ existingCount: 0 }]])
                .mockResolvedValueOnce([[
                    { studentId: 1 },
                    { studentId: 2 }
                ]])
                .mockResolvedValueOnce([{ affectedRows: 2 }]);

            const result = await publishAssessment(
                10,
                202201,
                dueDate
            );

            expect(result).toEqual({
                success: true,
                studentsAssigned: 2
            });
            expect(connection.query).toHaveBeenNthCalledWith(
                3,
                expect.stringContaining('SELECT studentId FROM student'),
                ['A1', 202201]
            );
            expect(connection.query).toHaveBeenNthCalledWith(
                4,
                expect.stringContaining('INSERT INTO studentAssessment'),
                [[
                    [1, 10, 202201, 'Assigned', dueDate],
                    [2, 10, 202201, 'Assigned', dueDate]
                ]]
            );
            expectCommitted();
        });

        test('returns NOT_FOUND when the assessment does not exist', async () => {
            connection.query.mockResolvedValueOnce([[]]);

            await expect(
                publishAssessment(999, 202201, dueDate)
            ).resolves.toEqual({ success: false, reason: 'NOT_FOUND' });
            expectRolledBack();
        });

        test('rejects an assessment already published this semester', async () => {
            connection.query
                .mockResolvedValueOnce([[{ band: 'A1' }]])
                .mockResolvedValueOnce([[{ existingCount: 1 }]]);

            await expect(
                publishAssessment(10, 202201, dueDate)
            ).resolves.toEqual({
                success: false,
                reason: 'ALREADY_PUBLISHED'
            });
            expect(connection.query).toHaveBeenCalledTimes(2);
            expectRolledBack();
        });

        test('returns NO_STUDENTS when the band has no students', async () => {
            connection.query
                .mockResolvedValueOnce([[{ band: 'A1' }]])
                .mockResolvedValueOnce([[{ existingCount: 0 }]])
                .mockResolvedValueOnce([[]]);

            await expect(
                publishAssessment(10, 202201, dueDate)
            ).resolves.toEqual({
                success: false,
                reason: 'NO_STUDENTS'
            });
            expectRolledBack();
        });

        test('rolls back, releases and rethrows database errors', async () => {
            connection.query.mockRejectedValueOnce(
                new Error('Database failure')
            );

            await expect(
                publishAssessment(10, 202201, dueDate)
            ).rejects.toThrow('Database failure');
            expectRolledBack();
        });
    });

    describe('unpublishAssessment', () => {
        test('deletes assignments when nobody has submitted', async () => {
            connection.query
                .mockResolvedValueOnce([[{ existingCount: 2 }]])
                .mockResolvedValueOnce([[{ submittedCount: 0 }]])
                .mockResolvedValueOnce([{ affectedRows: 2 }]);

            await expect(
                unpublishAssessment(10, 202201)
            ).resolves.toEqual({ success: true });
            expect(connection.query).toHaveBeenNthCalledWith(
                3,
                expect.stringContaining('DELETE FROM studentAssessment'),
                [10, 202201]
            );
            expectCommitted();
        });

        test('returns NOT_PUBLISHED when no assignments exist', async () => {
            connection.query.mockResolvedValueOnce([[
                { existingCount: 0 }
            ]]);

            await expect(
                unpublishAssessment(10, 202201)
            ).resolves.toEqual({
                success: false,
                reason: 'NOT_PUBLISHED'
            });
            expect(connection.query).toHaveBeenCalledTimes(1);
            expectRolledBack();
        });

        test('returns HAS_SUBMISSIONS when work was submitted or graded', async () => {
            connection.query
                .mockResolvedValueOnce([[{ existingCount: 2 }]])
                .mockResolvedValueOnce([[{ submittedCount: 1 }]]);

            await expect(
                unpublishAssessment(10, 202201)
            ).resolves.toEqual({
                success: false,
                reason: 'HAS_SUBMISSIONS'
            });
            expect(connection.query).toHaveBeenCalledTimes(2);
            expectRolledBack();
        });

        test('rolls back, releases and rethrows database errors', async () => {
            connection.query.mockRejectedValueOnce(
                new Error('Database failure')
            );

            await expect(
                unpublishAssessment(10, 202201)
            ).rejects.toThrow('Database failure');
            expectRolledBack();
        });
    });
});