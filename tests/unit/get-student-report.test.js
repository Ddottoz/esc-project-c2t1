const { getStudentReport } = require('../../controllers/reportController'); // Update path as needed
const StudentModel = require('../../models/student');

// Mock StudentModel dependency
jest.mock('../../models/student');

describe('getStudentReport Controller Unit Tests', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            params: {},
            query: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            render: jest.fn(),
            json: jest.fn()
        };

        // Suppress console.error during tests
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        console.error.mockRestore();
    });

    test('Unit 1.1: Successful render with query bounds and normalized student data', async () => {
        req.params.id = '101';
        req.query = { startSem: '202501', endSem: '202502' };

        const mockReportData = {
            student: {
                studentId: '101',
                firstName: 'John',
                lastName: 'Doe',
                enrolmentDate: '2025-01-15T00:00:00.000Z',
                currentBand: 'Band 1',
                semesterBandId: 'B1'
            },
            assessments: [
                { semesterId: '202501', component: 'Writing', assessmentType: 'Essay', score: 80 }
            ],
            availableSemesters: ['202501', '202502'],
            activeStartSem: '202501',
            activeEndSem: '202502'
        };

        StudentModel.generateReport.mockResolvedValue(mockReportData);

        await getStudentReport(req, res);

        expect(StudentModel.generateReport).toHaveBeenCalledWith('101', '202501', '202502');
        expect(res.render).toHaveBeenCalledWith('report', expect.objectContaining({
            activeTop: 'students',
            type: 'student',
            activeSide: 'progress',
            student: expect.objectContaining({
                id: '101',
                name: 'John Doe',
                formattedEnrolmentDate: '15 Jan 2025'
            }),
            groupedBySemester: {
                '202501': {
                    Writing: [
                        { semesterId: '202501', component: 'Writing', assessmentType: 'Essay', score: 80 }
                    ]
                }
            },
            selectedStartSem: '202501',
            selectedEndSem: '202502'
        }));
    });

    test('Unit 1.2: Returns 404 when student report data is not found', async () => {
        req.params.id = '999';
        req.query = { startSem: '202501', endSem: '202502' };

        StudentModel.generateReport.mockResolvedValue(null);

        await getStudentReport(req, res);

        expect(StudentModel.generateReport).toHaveBeenCalledWith('999', '202501', '202502');
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.render).toHaveBeenCalledWith('error', {
            message: 'Student report not found',
            error: { status: 404 }
        });
    });

    test('Unit 1.3: Falls back to available semesters when active bounds and queries are missing', async () => {
        req.params.id = '101';
        req.query = {};

        const mockReportData = {
            student: { id: '101', firstName: 'Jane' },
            assessments: [],
            availableSemesters: [{ raw: '202501' }, { raw: '202602' }]
        };

        StudentModel.generateReport.mockResolvedValue(mockReportData);

        await getStudentReport(req, res);

        expect(StudentModel.generateReport).toHaveBeenCalledWith('101', undefined, undefined);
        expect(res.render).toHaveBeenCalledWith('report', expect.objectContaining({
            selectedStartSem: '202501',
            selectedEndSem: '202602'
        }));
    });

    test('Unit 1.4: Handles internal server error (500) when StudentModel throws an exception', async () => {
        req.params.id = '101';
        const dbError = new Error('Database connection failed');

        StudentModel.generateReport.mockRejectedValue(dbError);

        await getStudentReport(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.render).toHaveBeenCalledWith('error', {
            message: 'Failed to generate student report',
            error: dbError
        });
    });
});