const { generateAiInsight } = require('../../controllers/reportController'); // Update path as needed
const StudentModel = require('../../models/student');
const { generateStudentInsight } = require('../../services/aiService');

// Mock dependencies
jest.mock('../../models/student');
jest.mock('../../services/aiService');

describe('generateAiInsight Controller Unit Tests', () => {
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

    test('Unit 2.1: Successfully generates AI insight and returns JSON response', async () => {
        req.params.id = '101';
        req.query = { startSem: '202501' };

        const mockReportData = {
            student: { firstName: 'John', age: 15 },
            assessments: [
                { semesterId: '202501', component: 'Reading', score: 90 }
            ]
        };

        const mockAiResponse = 'Student John shows strong reading comprehension capability.';

        StudentModel.generateReport.mockResolvedValue(mockReportData);
        generateStudentInsight.mockResolvedValue(mockAiResponse);

        await generateAiInsight(req, res);

        expect(StudentModel.generateReport).toHaveBeenCalledWith('101', '202501', undefined);
        expect(generateStudentInsight).toHaveBeenCalledWith(
            mockReportData.student,
            {
                '202501': {
                    Reading: [{ semesterId: '202501', component: 'Reading', score: 90 }]
                }
            }
        );
        expect(res.json).toHaveBeenCalledWith({ aiInsight: mockAiResponse });
    });

    test('Unit 2.2: Returns 404 JSON when student report data is missing', async () => {
        req.params.id = '999';

        StudentModel.generateReport.mockResolvedValue(null);

        await generateAiInsight(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Student data not found' });
        expect(generateStudentInsight).not.toHaveBeenCalled();
    });

    test('Unit 2.3: Handles external AI service failure (500)', async () => {
        req.params.id = '101';

        const mockReportData = {
            student: { firstName: 'John' },
            assessments: []
        };

        StudentModel.generateReport.mockResolvedValue(mockReportData);
        generateStudentInsight.mockRejectedValue(new Error('LLM engine unavailable'));

        await generateAiInsight(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to generate AI insight' });
    });
});