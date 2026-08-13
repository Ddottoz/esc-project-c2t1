const {
    addAssessment,
    editAssessment,
    removeAssessment,
    getAssessment,
    getAssessments,
    publish,
    renderBandAssessmentsPage,
    unpublish,
    validateAssessmentBody
} = require('../../controllers/assessmentController');


const {
    getSemAndBandBySemBandId,
    createAssessment,
    updateAssessment,
    getAssessmentById,
    getAllAssessmentsFiltered,
    publishAssessment,
    deleteAssessment,
    unpublishAssessment
} = require('../../models/assessment');

const BandModel = require('../../models/band');

jest.mock('../../models/assessment', () => ({
    getSemAndBandBySemBandId: jest.fn(),
    createAssessment: jest.fn(),
    updateAssessment: jest.fn(),
    getAssessmentById: jest.fn(),
    getAllAssessmentsFiltered: jest.fn(),
    publishAssessment: jest.fn(),
    deleteAssessment: jest.fn(),
    unpublishAssessment: jest.fn()
}));

jest.mock('../../models/band', () => ({
    getBand: jest.fn()
}));


// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

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
    rubrics: 'Sample rubric',
    semesterId: 1
};


// =========================================================
// validateAssessmentBody
// =========================================================

describe('validateAssessmentBody', () => {

    test('should return null for valid assessment data', () => {
        expect(validateAssessmentBody({
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'A1',
            passingMark: 50,
            totalMark: 100,
        })).toBeNull();
    });


    test.each([
        ['assessmentType', ''],
        ['component', ''],
        ['band', ''],
        ['passingMark', null],
        ['totalMark', null]
    ])(
        'should reject missing %s',
        (field, value) => {

            const body = {
                assessmentType: 'Fluency',
                component: 'Vocabulary',
                band: 'A1',
                passingMark: 50,
                totalMark: 100
            };

            body[field] = value;

            expect(validateAssessmentBody(body))
                .toBe('All fields are required');
        }
    );


    test('should reject invalid assessment type', () => {
        const body = {
            assessmentType: 'Speed Reading',
            component: 'Vocabulary',
            band: 'A1',
            passingMark: 50,
            totalMark: 100,

        };

        expect(validateAssessmentBody(body))
            .toBe(
                'assessmentType must be one of: Letter Formation, Narrative Writing, Exposition Writing, Edit and Diagram 1, Edit and Diagram 2, Edit and Diagram 3, Comprehension, Primary, Secondary, Picture Naming, Picture Description, PA Identification, Phonics, Word Reading Accuracy, Fluency, Word Spelling'
            );
    });


    test('should reject assessment type with incorrect case', () => {
        const body = {
            assessmentType: 'fluency',
            component: 'Vocabulary',
            band: 'A1',
            passingMark: 50,
            totalMark: 100,

        };

        expect(validateAssessmentBody(body)).not.toBeNull();
    });


    test('should reject invalid component', () => {
        const body = {
            assessmentType: 'Fluency',
            component: 'Grammar',
            band: 'A1',
            passingMark: 50,
            totalMark: 100,

        };

        expect(validateAssessmentBody(body))
            .toBe(
                'component must be one of: Vocabulary, Writing, Comprehension, PA / Phonics'
            );
    });


    test('should reject invalid band', () => {
        const body = {
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'D10',
            passingMark: 50,
            totalMark: 100,

        };

        expect(validateAssessmentBody(body))
            .toBe(
                'band must be one of: A1, A2, A3, B4, B5, B6, C7, C8, C9'
            );
    });


    test('should accept band case-insensitively', () => {
        const body = {
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'a1',
            passingMark: 50,
            totalMark: 100,

        };

        expect(validateAssessmentBody(body)).toBeNull();
    });


    test.each([
        [50.5, 'passingMark must be an integer'],
        ['50.5', 'passingMark must be an integer'],
        ['', 'All fields are required']
    ])(
        'should validate passingMark %s correctly',
        (passingMark, expected) => {

            const body = {
                assessmentType: 'Fluency',
                component: 'Vocabulary',
                band: 'A1',
                passingMark,
                totalMark: 100,

            };

            expect(validateAssessmentBody(body)).toBe(expected);
        }
    );


    test('should reject non-integer totalMark', () => {
        const body = {
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'A1',
            passingMark: 50,
            totalMark: 99.9,

        };

        expect(validateAssessmentBody(body))
            .toBe('totalMark must be an integer');
    });


    test('should reject negative passingMark', () => {
        const body = {
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'A1',
            passingMark: -1,
            totalMark: 100,

        };

        expect(validateAssessmentBody(body))
            .toBe('passingMark cannot be negative');
    });


    test('should reject negative totalMark', () => {
        const body = {
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'A1',
            passingMark: 50,
            totalMark: -1,

        };

        expect(validateAssessmentBody(body))
            .toBe('totalMark cannot be negative');
    });


    test('should allow passingMark equal to totalMark', () => {
        const body = {
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'A1',
            passingMark: 100,
            totalMark: 100,

        };

        expect(validateAssessmentBody(body)).toBeNull();
    });


    test('should allow passingMark of 0', () => {
        const body = {
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'A1',
            passingMark: 0,
            totalMark: 100,

        };

        expect(validateAssessmentBody(body)).toBeNull();
    });


    test('should reject passingMark greater than totalMark', () => {
        const body = {
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'A1',
            passingMark: 101,
            totalMark: 100,

        };

        expect(validateAssessmentBody(body))
            .toBe('Passing Mark cannot exceed Total Mark');
    });


});


// =========================================================
// addAssessment
// =========================================================

describe('addAssessment', () => {

    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            body: { ...validBody }
        };

        res = mockResponse();
    });


    test('should create assessment successfully', async () => {

        createAssessment.mockResolvedValue({
            success: true,
            assessmentId: 123
        });

        await addAssessment(req, res);

        expect(createAssessment).toHaveBeenCalledWith(
            {
                assessmentType: 'Fluency',
                component: 'Vocabulary',
                band: 'A1',
                passingMark: 50,
                totalMark: 100,
                rubrics: 'Sample rubric'
            },
            1
        );

        expect(res.status).toHaveBeenCalledWith(201);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Assessment created successfully',
            assessmentId: 123
        });
    });


    test('should return 400 for invalid request body', async () => {

        req.body.assessmentType = '';

        await addAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'All fields are required'
        });

        expect(createAssessment).not.toHaveBeenCalled();
    });


    test('should convert band to uppercase before calling model', async () => {

        req.body.band = 'a1';

        createAssessment.mockResolvedValue({
            success: true,
            assessmentId: 123
        });

        await addAssessment(req, res);

        expect(createAssessment).toHaveBeenCalledWith(
            expect.objectContaining({
                band: 'A1'
            }),
            1
        );
    });


    test('should return 409 when assessment type already exists', async () => {

        createAssessment.mockResolvedValue({
            success: false,
            reason: 'DUPLICATE_ASSESSMENT_TYPE'
        });

        await addAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(409);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Assessment type already exists for this band'
        });
    });


    test('should return 404 when semester band is not found', async () => {

        createAssessment.mockResolvedValue({
            success: false,
            reason: 'SEMESTER_BAND_NOT_FOUND'
        });

        await addAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(404);

        expect(res.json).toHaveBeenCalledWith({
            message: 'No matching band found for this semester'
        });
    });


    test('should return 500 for model failure', async () => {

        createAssessment.mockResolvedValue({
            success: false,
            reason: 'UNKNOWN_ERROR'
        });

        await addAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Failed to create assessment'
        });
    });


    test('should return 500 when model throws an error', async () => {

        createAssessment.mockRejectedValue(
            new Error('Database failure')
        );

        await addAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Failed to create assessment'
        });
    });
});


// =========================================================
// editAssessment
// =========================================================

describe('editAssessment', () => {

    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            params: {
                assessmentId: '123'
            },
            body: { ...validBody }
        };

        res = mockResponse();
    });


    test('should update assessment successfully', async () => {

        updateAssessment.mockResolvedValue({
            success: true
        });

        await editAssessment(req, res);

        expect(updateAssessment).toHaveBeenCalledWith(
            '123',
            {
                assessmentType: 'Fluency',
                component: 'Vocabulary',
                band: 'A1',
                passingMark: 50,
                totalMark: 100,
                rubrics: 'Sample rubric'
            },
            1
        );

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Assessment updated successfully'
        });
    });


    test('should return 400 for invalid body', async () => {

        req.body.component = '';

        await editAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'All fields are required'
        });

        expect(updateAssessment).not.toHaveBeenCalled();
    });


    test('should return 404 when assessment does not exist', async () => {

        updateAssessment.mockResolvedValue({
            success: false,
            reason: 'NOT_FOUND'
        });

        await editAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(404);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Assessment not found'
        });
    });


    test('should return 409 when assessment is already published', async () => {

        updateAssessment.mockResolvedValue({
            success: false,
            reason: 'ALREADY_PUBLISHED'
        });

        await editAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(409);

        expect(res.json).toHaveBeenCalledWith({
            message:
                'Cannot edit: this assessment has already been published for this semester'
        });
    });


    test('should return 409 when fields are locked', async () => {

        updateAssessment.mockResolvedValue({
            success: false,
            reason: 'LOCKED_FIELDS'
        });

        await editAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(409);

        expect(res.json).toHaveBeenCalledWith({
            message:
                'This assessment has been published before: only rubrics can be changed'
        });
    });


    test('should return 409 for duplicate assessment type', async () => {

        updateAssessment.mockResolvedValue({
            success: false,
            reason: 'DUPLICATE_ASSESSMENT_TYPE'
        });

        await editAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(409);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Assessment type already exists for this band'
        });
    });


    test('should return 404 when semester band is not found', async () => {

        updateAssessment.mockResolvedValue({
            success: false,
            reason: 'SEMESTER_BAND_NOT_FOUND'
        });

        await editAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(404);

        expect(res.json).toHaveBeenCalledWith({
            message: 'No matching band found for this semester'
        });
    });


    test('should return 500 for unknown model failure', async () => {

        updateAssessment.mockResolvedValue({
            success: false,
            reason: 'UNKNOWN_ERROR'
        });

        await editAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Failed to update assessment'
        });
    });


    test('should return 500 when model throws error', async () => {

        updateAssessment.mockRejectedValue(
            new Error('Database failure')
        );

        await editAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Failed to update assessment'
        });
    });
});


// =========================================================
// removeAssessment
// =========================================================

describe('removeAssessment', () => {

    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            params: {
                assessmentId: '123'
            }
        };

        res = mockResponse();
    });


    test('should delete assessment successfully', async () => {

        deleteAssessment.mockResolvedValue({
            success: true
        });

        await removeAssessment(req, res);

        expect(deleteAssessment)
            .toHaveBeenCalledWith('123');

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Assessment deleted successfully'
        });
    });


    test('should return 404 when assessment does not exist', async () => {

        deleteAssessment.mockResolvedValue({
            success: false,
            reason: 'NOT_FOUND'
        });

        await removeAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(404);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Assessment not found'
        });
    });


    test('should return 409 when assessment has published records', async () => {

        deleteAssessment.mockResolvedValue({
            success: false,
            reason: 'ALREADY_PUBLISHED'
        });

        await removeAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(409);

        expect(res.json).toHaveBeenCalledWith({
            message:
                'Cannot delete: this assessment has published records'
        });
    });


    test('should return 500 when model throws error', async () => {

        deleteAssessment.mockRejectedValue(
            new Error('Database failure')
        );

        await removeAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Failed to delete assessment'
        });
    });
});


// =========================================================
// unpublish
// =========================================================

describe('unpublish', () => {

    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            params: {
                assessmentId: '123'
            },
            body: {
                semesterId: '1'
            }
        };

        res = mockResponse();
    });


    test('should unpublish assessment successfully', async () => {

        unpublishAssessment.mockResolvedValue({
            success: true
        });

        await unpublish(req, res);

        expect(unpublishAssessment)
            .toHaveBeenCalledWith('123', 1);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Assessment unpublished successfully'
        });
    });


    test('should return 400 when semesterId is missing', async () => {

        req.body.semesterId = undefined;

        await unpublish(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'semesterId is required'
        });

        expect(unpublishAssessment).not.toHaveBeenCalled();
    });


    test('should return 400 when assessment is not published', async () => {

        unpublishAssessment.mockResolvedValue({
            success: false,
            reason: 'NOT_PUBLISHED'
        });

        await unpublish(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message:
                'This assessment is not published for this semester'
        });
    });


    test('should return 409 when students have submitted work', async () => {

        unpublishAssessment.mockResolvedValue({
            success: false,
            reason: 'HAS_SUBMISSIONS'
        });

        await unpublish(req, res);

        expect(res.status).toHaveBeenCalledWith(409);

        expect(res.json).toHaveBeenCalledWith({
            message:
                'Cannot unpublish: students have already submitted work'
        });
    });


    test('should return 500 when model throws error', async () => {

        unpublishAssessment.mockRejectedValue(
            new Error('Database failure')
        );

        await unpublish(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Failed to unpublish assessment'
        });
    });
});


// =========================================================
// getAssessment
// =========================================================

describe('getAssessment', () => {

    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            params: {
                assessmentId: '123'
            }
        };

        res = mockResponse();
    });


    test('should return assessment successfully', async () => {

        const assessment = {
            assessmentId: 123,
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'A1'
        };

        getAssessmentById.mockResolvedValue(assessment);

        await getAssessment(req, res);

        expect(getAssessmentById)
            .toHaveBeenCalledWith('123');

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            data: assessment
        });
    });


    test('should return 404 when assessment does not exist', async () => {

        getAssessmentById.mockResolvedValue(null);

        await getAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(404);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Assessment not found'
        });
    });


    test('should return 500 when model throws error', async () => {

        getAssessmentById.mockRejectedValue(
            new Error('Database failure')
        );

        await getAssessment(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Failed to fetch assessment'
        });
    });
});


// =========================================================
// getAssessments
// =========================================================

describe('getAssessments', () => {

    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            params: {
                semesterBandId: 'band-a1-2022-s1'
            },
            query: {}
        };

        getSemAndBandBySemBandId.mockResolvedValue({
            semesterId: 202201,
            band: 'A1'
        });


        res = mockResponse();
    });


    test('should return all assessments successfully', async () => {

        const assessments = [
            {
                assessmentId: 1,
                assessmentType: 'Fluency'
            },
            {
                assessmentId: 2,
                assessmentType: 'Comprehension'
            }
        ];

        getAllAssessmentsFiltered.mockResolvedValue(assessments);

        await getAssessments(req, res);

        expect(getAllAssessmentsFiltered)
            .toHaveBeenCalledWith(202201, null, null, 'A1');

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            data: assessments
        });
    });


    test('should filter by assessmentType', async () => {

        getAllAssessmentsFiltered.mockResolvedValue([]);

        req.query.assessmentType = 'Fluency';

        await getAssessments(req, res);

        expect(getAllAssessmentsFiltered)
            .toHaveBeenCalledWith(
                202201,
                'Fluency',
                null,
                'A1'
            );

        expect(res.status).toHaveBeenCalledWith(200);
    });


    test('should filter by component', async () => {

        getAllAssessmentsFiltered.mockResolvedValue([]);

        req.query.component = 'Vocabulary';

        await getAssessments(req, res);

        expect(getAllAssessmentsFiltered)
            .toHaveBeenCalledWith(
                202201,
                null,
                'Vocabulary',
                'A1'
            );
    });


    test('should filter by band and convert band to uppercase', async () => {

        getAllAssessmentsFiltered.mockResolvedValue([]);

        req.query.band = 'a1';

        await getAssessments(req, res);

        expect(getAllAssessmentsFiltered)
            .toHaveBeenCalledWith(
                202201,
                null,
                null,
                'A1'
            );
    });


    test('should apply all filters together', async () => {

        getAllAssessmentsFiltered.mockResolvedValue([]);

        req.query = {
            assessmentType: 'Fluency',
            component: 'Vocabulary',
            band: 'a1'
        };

        await getAssessments(req, res);

        expect(getAllAssessmentsFiltered)
            .toHaveBeenCalledWith(
                202201,
                'Fluency',
                'Vocabulary',
                'A1'
            );
    });


    test('should return 400 when semesterBandId is missing', async () => {

        req.params.semesterBandId = undefined;

        await getAssessments(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'semesterBandId is required'
        });

        expect(getAllAssessmentsFiltered).not.toHaveBeenCalled();
    });


    test('should return 404 when semester band is not found', async () => {
        getSemAndBandBySemBandId.mockResolvedValue(null);

        await getAssessments(req, res);

        expect(getSemAndBandBySemBandId)
            .toHaveBeenCalledWith('band-a1-2022-s1');

        expect(getAllAssessmentsFiltered)
            .not.toHaveBeenCalled();

        expect(res.status)
            .toHaveBeenCalledWith(404);

        expect(res.json)
            .toHaveBeenCalledWith({
                message: 'Semester band not found'
            });
    });


    test('should return 500 when model throws error', async () => {

        getAllAssessmentsFiltered.mockRejectedValue(
            new Error('Database failure')
        );

        await getAssessments(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Failed to fetch assessments'
        });
    });
});


// =========================================================
// publish
// =========================================================

describe('publish', () => {

    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            params: {
                assessmentId: '123'
            },
            body: {
                semesterId: '1',
                dueDate: '2026-08-31'
            }
        };

        res = mockResponse();
    });


    test('should publish assessment successfully', async () => {

        publishAssessment.mockResolvedValue({
            success: true,
            studentsAssigned: 25
        });

        await publish(req, res);

        expect(publishAssessment)
            .toHaveBeenCalledWith(
                '123',
                1,
                '2026-08-31'
            );

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Assessment published successfully',
            studentsAssigned: 25
        });
    });


    test('should return 400 when semesterId is missing', async () => {

        req.body.semesterId = undefined;

        await publish(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'semesterId and dueDate are required'
        });

        expect(publishAssessment).not.toHaveBeenCalled();
    });


    test('should return 400 when dueDate is missing', async () => {

        req.body.dueDate = undefined;

        await publish(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'semesterId and dueDate are required'
        });

        expect(publishAssessment).not.toHaveBeenCalled();
    });


    test('should return 404 when assessment is not found', async () => {

        publishAssessment.mockResolvedValue({
            success: false,
            reason: 'NOT_FOUND'
        });

        await publish(req, res);

        expect(res.status).toHaveBeenCalledWith(404);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Assessment not found'
        });
    });


    test('should return 409 when assessment is already published', async () => {

        publishAssessment.mockResolvedValue({
            success: false,
            reason: 'ALREADY_PUBLISHED'
        });

        await publish(req, res);

        expect(res.status).toHaveBeenCalledWith(409);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Already published for this semester'
        });
    });


    test('should return 400 when there are no students', async () => {

        publishAssessment.mockResolvedValue({
            success: false,
            reason: 'NO_STUDENTS'
        });

        await publish(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message:
                'No students found for this band in this semester'
        });
    });


    test('should return 500 when model throws error', async () => {

        publishAssessment.mockRejectedValue(
            new Error('Database failure')
        );

        await publish(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Failed to publish assessment'
        });
    });
});


// =========================================================
// renderBandAssessmentsPage
// =========================================================

describe('renderBandAssessmentsPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render assessments page with semester band details', async () => {
        const req = {
            params: {
                semesterBandId: 'band-a1-2022-s1'
            }
        };

        const res = mockResponse();

        const band = {
            semesterId: 202201,
            bandCode: 'A1',
            name: 'Band A1'
        };

        BandModel.getBand.mockResolvedValue(band);

        await renderBandAssessmentsPage(req, res);

        expect(BandModel.getBand)
            .toHaveBeenCalledWith('band-a1-2022-s1');

        expect(res.render).toHaveBeenCalledWith(
            'assessmentsList',
            {
                semesterBandId: 'band-a1-2022-s1',
                semesterId: 202201,
                band,
                bandCode: 'A1'
            }
        );
    });

    test('should render 404 when the band does not exist', async () => {
        const req = {
            params: { semesterBandId: 'missing-band' }
        };
        const res = mockResponse();

        BandModel.getBand.mockResolvedValue(null);

        await renderBandAssessmentsPage(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.render).toHaveBeenCalledWith('error', {
            message: 'Band not found',
            error: { status: 404 }
        });
    });
});