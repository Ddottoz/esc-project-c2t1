jest.mock('../../models/assessment', () => ({
    createAssessment: jest.fn(),
    updateAssessment: jest.fn(),
    getAssessmentById: jest.fn(),
    getAllAssessmentsFiltered: jest.fn(),
    getSemAndBandBySemBandId: jest.fn(),
    publishAssessment: jest.fn(),
    unpublishAssessment: jest.fn(),
    deleteAssessment: jest.fn()
}));

jest.mock('../../models/band', () => ({
    getBand: jest.fn()
}));

const {
    createAssessment,
    updateAssessment,
    publishAssessment,
    unpublishAssessment,
    deleteAssessment
} = require('../../models/assessment');

const {
    validateAssessmentBody,
    addAssessment,
    editAssessment,
    publish,
    unpublish,
    removeAssessment
} = require('../../controllers/assessmentController');

function mockResponse() {
    const res = {};

    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);

    return res;
}

const validBody = {
    assessmentType: 'Fluency',
    component: 'Vocabulary',
    band: 'A1',
    passingMark: 50,
    totalMark: 100,
    rubrics: 'Read each word clearly.',
    semesterId: 202201
};

describe('assessmentController', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('validateAssessmentBody', () => {
        test('accepts a valid body', () => {
            expect(
                validateAssessmentBody(validBody)
            ).toBeNull();
        });

        test.each([
            ['assessmentType', ''],
            ['component', ''],
            ['band', ''],
            ['passingMark', null],
            ['totalMark', null]
        ])(
            'rejects missing %s',
            (field, value) => {
                const body = {
                    ...validBody,
                    [field]: value
                };

                expect(
                    validateAssessmentBody(body)
                ).toBe('All fields are required');
            }
        );

        test('rejects an invalid assessment type', () => {
            expect(
                validateAssessmentBody({
                    ...validBody,
                    assessmentType: 'Speed Reading'
                })
            ).toBe(
                'assessmentType must be one of: ' +
                'Letter Formation, Narrative Writing, ' +
                'Exposition Writing, Edit and Diagram 1, ' +
                'Edit and Diagram 2, Edit and Diagram 3, ' +
                'Comprehension, Primary, Secondary, ' +
                'Picture Naming, Picture Description, ' +
                'PA Identification, Phonics, ' +
                'Word Reading Accuracy, Fluency, Word Spelling'
            );
        });

        test('rejects an invalid component', () => {
            expect(
                validateAssessmentBody({
                    ...validBody,
                    component: 'Grammar'
                })
            ).toBe(
                'component must be one of: ' +
                'Vocabulary, Writing, Comprehension, PA / Phonics'
            );
        });

        test('rejects an invalid band', () => {
            expect(
                validateAssessmentBody({
                    ...validBody,
                    band: 'D10'
                })
            ).toBe(
                'band must be one of: ' +
                'A1, A2, A3, B4, B5, B6, C7, C8, C9'
            );
        });

        test('accepts a lowercase valid band', () => {
            expect(
                validateAssessmentBody({
                    ...validBody,
                    band: 'a1'
                })
            ).toBeNull();
        });

        test.each([
            [
                {
                    passingMark: 50.5,
                    totalMark: 100
                },
                'passingMark must be an integer'
            ],
            [
                {
                    passingMark: 50,
                    totalMark: 99.5
                },
                'totalMark must be an integer'
            ],
            [
                {
                    passingMark: -1,
                    totalMark: 100
                },
                'passingMark cannot be negative'
            ],
            [
                {
                    passingMark: 0,
                    totalMark: -1
                },
                'totalMark cannot be negative'
            ],
            [
                {
                    passingMark: 101,
                    totalMark: 100
                },
                'passingMark cannot exceed 100'
            ],
            [
                {
                    passingMark: 0,
                    totalMark: 101
                },
                'totalMark cannot exceed 100'
            ],
            [
                {
                    passingMark: 51,
                    totalMark: 50
                },
                'Passing Mark cannot exceed Total Mark'
            ]
        ])(
            'rejects invalid mark combination %#',
            (marks, expected) => {
                expect(
                    validateAssessmentBody({
                        ...validBody,
                        ...marks
                    })
                ).toBe(expected);
            }
        );

        test.each([
            [0, 0],
            [0, 100],
            [1, 100],
            [50, 100],
            [99, 100],
            [100, 100]
        ])(
            'accepts passingMark %i and totalMark %i',
            (passingMark, totalMark) => {
                expect(
                    validateAssessmentBody({
                        ...validBody,
                        passingMark,
                        totalMark
                    })
                ).toBeNull();
            }
        );
    });

    describe('addAssessment', () => {
        test('returns 400 for invalid body', async () => {
            const req = {
                body: {
                    ...validBody,
                    assessmentType: ''
                }
            };

            const res = mockResponse();

            await addAssessment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);

            expect(res.json).toHaveBeenCalledWith({
                message: 'All fields are required'
            });

            expect(
                createAssessment
            ).not.toHaveBeenCalled();
        });

        test('creates an assessment successfully', async () => {
            const req = {
                body: {
                    ...validBody,
                    band: 'a1'
                }
            };

            const res = mockResponse();

            createAssessment.mockResolvedValue({
                success: true,
                assessmentId: 15
            });

            await addAssessment(req, res);

            expect(createAssessment).toHaveBeenCalledWith(
                {
                    assessmentType: 'Fluency',
                    component: 'Vocabulary',
                    band: 'A1',
                    passingMark: 50,
                    totalMark: 100,
                    rubrics: 'Read each word clearly.'
                },
                202201
            );

            expect(res.status).toHaveBeenCalledWith(201);

            expect(res.json).toHaveBeenCalledWith({
                message: 'Assessment created successfully',
                assessmentId: 15
            });
        });

        test.each([
            [
                'DUPLICATE_ASSESSMENT_TYPE',
                409,
                'Assessment type already exists for this band'
            ],
            [
                'SEMESTER_BAND_NOT_FOUND',
                404,
                'No matching band found for this semester'
            ],
            [
                'WEIGHT_CREATION_FAILED',
                500,
                'Failed to assign weight to assessment'
            ],
            [
                'UNKNOWN_FAILURE',
                500,
                'Failed to create assessment'
            ]
        ])(
            'maps %s to HTTP %i',
            async (reason, status, message) => {
                const req = {
                    body: { ...validBody }
                };

                const res = mockResponse();

                createAssessment.mockResolvedValue({
                    success: false,
                    reason
                });

                await addAssessment(req, res);

                expect(res.status).toHaveBeenCalledWith(
                    status
                );

                expect(res.json).toHaveBeenCalledWith({
                    message
                });
            }
        );

        test('returns 500 when model throws', async () => {
            const req = {
                body: { ...validBody }
            };

            const res = mockResponse();

            createAssessment.mockRejectedValue(
                new Error('Database insert failed')
            );

            await addAssessment(req, res);

            expect(res.status).toHaveBeenCalledWith(500);

            expect(res.json).toHaveBeenCalledWith({
                message: 'Failed to create assessment'
            });
        });
    });

    describe('editAssessment', () => {
        test('returns 400 for invalid body', async () => {
            const req = {
                params: {
                    assessmentId: '15'
                },
                body: {
                    ...validBody,
                    component: ''
                }
            };

            const res = mockResponse();

            await editAssessment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);

            expect(updateAssessment).not.toHaveBeenCalled();
        });

        test('updates an assessment successfully', async () => {
            const req = {
                params: {
                    assessmentId: '15'
                },
                body: {
                    ...validBody,
                    passingMark: 60,
                    rubrics: 'Updated rubric.'
                }
            };

            const res = mockResponse();

            updateAssessment.mockResolvedValue({
                success: true
            });

            await editAssessment(req, res);

            expect(updateAssessment).toHaveBeenCalledWith(
                '15',
                {
                    assessmentType: 'Fluency',
                    component: 'Vocabulary',
                    band: 'A1',
                    passingMark: 60,
                    totalMark: 100,
                    rubrics: 'Updated rubric.'
                },
                202201
            );

            expect(res.status).toHaveBeenCalledWith(200);

            expect(res.json).toHaveBeenCalledWith({
                message: 'Assessment updated successfully'
            });
        });

        test.each([
            [
                'NOT_FOUND',
                404,
                'Assessment not found'
            ],
            [
                'ALREADY_PUBLISHED',
                409,
                'Cannot edit: this assessment has already ' +
                'been published for this semester'
            ],
            [
                'LOCKED_FIELDS',
                409,
                'This assessment has been published before: ' +
                'only rubrics can be changed'
            ],
            [
                'DUPLICATE_ASSESSMENT_TYPE',
                409,
                'Assessment type already exists for this band'
            ],
            [
                'SEMESTER_BAND_NOT_FOUND',
                404,
                'No matching band found for this semester'
            ],
            [
                'UNKNOWN_FAILURE',
                500,
                'Failed to update assessment'
            ]
        ])(
            'maps edit failure %s to HTTP %i',
            async (reason, status, message) => {
                const req = {
                    params: {
                        assessmentId: '15'
                    },
                    body: { ...validBody }
                };

                const res = mockResponse();

                updateAssessment.mockResolvedValue({
                    success: false,
                    reason
                });

                await editAssessment(req, res);

                expect(res.status).toHaveBeenCalledWith(
                    status
                );

                expect(res.json).toHaveBeenCalledWith({
                    message
                });
            }
        );

        test('returns 500 when update throws', async () => {
            const req = {
                params: {
                    assessmentId: '15'
                },
                body: { ...validBody }
            };

            const res = mockResponse();

            updateAssessment.mockRejectedValue(
                new Error('Database update failed')
            );

            await editAssessment(req, res);

            expect(res.status).toHaveBeenCalledWith(500);

            expect(res.json).toHaveBeenCalledWith({
                message: 'Failed to update assessment'
            });
        });
    });

    describe('publish', () => {
        const validRequest = () => ({
            params: {
                assessmentId: '15'
            },
            body: {
                semesterId: 202201,
                dueDate: '2026-09-30'
            }
        });

        test.each([
            [
                {
                    dueDate: '2026-09-30'
                }
            ],
            [
                {
                    semesterId: 202201
                }
            ]
        ])(
            'returns 400 when publish body is incomplete',
            async body => {
                const req = {
                    params: {
                        assessmentId: '15'
                    },
                    body
                };

                const res = mockResponse();

                await publish(req, res);

                expect(res.status).toHaveBeenCalledWith(400);

                expect(res.json).toHaveBeenCalledWith({
                    message:
                        'semesterId and dueDate are required'
                });

                expect(
                    publishAssessment
                ).not.toHaveBeenCalled();
            }
        );

        test('publishes successfully', async () => {
            const req = validRequest();
            const res = mockResponse();

            publishAssessment.mockResolvedValue({
                success: true,
                studentsAssigned: 24
            });

            await publish(req, res);

            expect(publishAssessment).toHaveBeenCalledWith(
                '15',
                202201,
                '2026-09-30'
            );

            expect(res.status).toHaveBeenCalledWith(200);

            expect(res.json).toHaveBeenCalledWith({
                message: 'Assessment published successfully',
                studentsAssigned: 24
            });
        });

        test.each([
            [
                'NOT_FOUND',
                404,
                'Assessment not found'
            ],
            [
                'ALREADY_PUBLISHED',
                409,
                'Already published for this semester'
            ],
            [
                'NO_STUDENTS',
                400,
                'No students found for this band in this semester'
            ]
        ])(
            'maps publish failure %s to HTTP %i',
            async (reason, status, message) => {
                const req = validRequest();
                const res = mockResponse();

                publishAssessment.mockResolvedValue({
                    success: false,
                    reason
                });

                await publish(req, res);

                expect(res.status).toHaveBeenCalledWith(
                    status
                );

                expect(res.json).toHaveBeenCalledWith({
                    message
                });
            }
        );

        test('returns 500 when publishing throws', async () => {
            const req = validRequest();
            const res = mockResponse();

            publishAssessment.mockRejectedValue(
                new Error('Database insert failed')
            );

            await publish(req, res);

            expect(res.status).toHaveBeenCalledWith(500);

            expect(res.json).toHaveBeenCalledWith({
                message: 'Failed to publish assessment'
            });
        });
    });

    describe('unpublish', () => {
        const validRequest = () => ({
            params: {
                assessmentId: '15'
            },
            body: {
                semesterId: 202201
            }
        });

        test('returns 400 when semesterId is missing', async () => {
            const req = {
                params: {
                    assessmentId: '15'
                },
                body: {}
            };

            const res = mockResponse();

            await unpublish(req, res);

            expect(res.status).toHaveBeenCalledWith(400);

            expect(res.json).toHaveBeenCalledWith({
                message: 'semesterId is required'
            });

            expect(
                unpublishAssessment
            ).not.toHaveBeenCalled();
        });

        test('unpublishes successfully', async () => {
            const req = validRequest();
            const res = mockResponse();

            unpublishAssessment.mockResolvedValue({
                success: true
            });

            await unpublish(req, res);

            expect(unpublishAssessment).toHaveBeenCalledWith(
                '15',
                202201
            );

            expect(res.status).toHaveBeenCalledWith(200);

            expect(res.json).toHaveBeenCalledWith({
                message:
                    'Assessment unpublished successfully'
            });
        });

        test.each([
            [
                'NOT_PUBLISHED',
                400,
                'This assessment is not published for this semester'
            ],
            [
                'HAS_SUBMISSIONS',
                409,
                'Cannot unpublish: students have already submitted work'
            ]
        ])(
            'maps unpublish failure %s to HTTP %i',
            async (reason, status, message) => {
                const req = validRequest();
                const res = mockResponse();

                unpublishAssessment.mockResolvedValue({
                    success: false,
                    reason
                });

                await unpublish(req, res);

                expect(res.status).toHaveBeenCalledWith(
                    status
                );

                expect(res.json).toHaveBeenCalledWith({
                    message
                });
            }
        );

        test('returns 500 when unpublishing throws', async () => {
            const req = validRequest();
            const res = mockResponse();

            unpublishAssessment.mockRejectedValue(
                new Error('Database delete failed')
            );

            await unpublish(req, res);

            expect(res.status).toHaveBeenCalledWith(500);

            expect(res.json).toHaveBeenCalledWith({
                message: 'Failed to unpublish assessment'
            });
        });
    });

    describe('removeAssessment', () => {
        test('deletes successfully', async () => {
            const req = {
                params: {
                    assessmentId: '15'
                }
            };

            const res = mockResponse();

            deleteAssessment.mockResolvedValue({
                success: true
            });

            await removeAssessment(req, res);

            expect(deleteAssessment).toHaveBeenCalledWith(
                '15'
            );

            expect(res.status).toHaveBeenCalledWith(200);

            expect(res.json).toHaveBeenCalledWith({
                message: 'Assessment deleted successfully'
            });
        });

        test.each([
            [
                'NOT_FOUND',
                404,
                'Assessment not found'
            ],
            [
                'ALREADY_PUBLISHED',
                409,
                'Cannot delete: this assessment has published records'
            ],
            [
                'UNKNOWN_FAILURE',
                500,
                'Failed to delete assessment'
            ]
        ])(
            'maps delete failure %s to HTTP %i',
            async (reason, status, message) => {
                const req = {
                    params: {
                        assessmentId: '15'
                    }
                };

                const res = mockResponse();

                deleteAssessment.mockResolvedValue({
                    success: false,
                    reason
                });

                await removeAssessment(req, res);

                expect(res.status).toHaveBeenCalledWith(
                    status
                );

                expect(res.json).toHaveBeenCalledWith({
                    message
                });
            }
        );

        test('returns 500 when deletion throws', async () => {
            const req = {
                params: {
                    assessmentId: '15'
                }
            };

            const res = mockResponse();

            deleteAssessment.mockRejectedValue(
                new Error('Database delete failed')
            );

            await removeAssessment(req, res);

            expect(res.status).toHaveBeenCalledWith(500);

            expect(res.json).toHaveBeenCalledWith({
                message: 'Failed to delete assessment'
            });
        });
    });
});