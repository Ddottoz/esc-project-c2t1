const request = require('supertest');
const app = require('../../app'); // Path to your Express app instance
const { generateStudentInsight } = require('../../services/aiService');

// Mock external AI service call to prevent consuming API quotas during integration test runs
jest.mock('../../services/aiService');

describe('UC7: Generate Progress Report - generateAiInsight Integration Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Integration 2.1: Successfully fetches student data and returns AI insight JSON', async () => {
        const mockAiResponse = 'Student shows consistent growth across all reading components.';
        generateStudentInsight.mockResolvedValue(mockAiResponse);

        const res = await request(app)
            .get('/reports/student/101/ai-insight?startSem=202501');

        expect(res.statusCode).toEqual(200);
        expect(res.headers['content-type']).toMatch(/json/);
        expect(res.body).toEqual({ aiInsight: mockAiResponse });
        expect(generateStudentInsight).toHaveBeenCalled();
    });

    test('Integration 2.2: Returns 404 JSON error when requesting AI insight for non-existent student', async () => {
        const res = await request(app)
            .get('/reports/student/99999/ai-insight');

        expect(res.statusCode).toEqual(404);
        expect(res.headers['content-type']).toMatch(/json/);
        expect(res.body).toEqual({ error: 'Student data not found' });
        expect(generateStudentInsight).not.toHaveBeenCalled();
    });

    test('Integration 2.3: Handles 500 JSON error when external AI service fails', async () => {
        generateStudentInsight.mockRejectedValue(new Error('LLM Service Unavailable'));

        const res = await request(app)
            .get('/reports/student/101/ai-insight');

        expect(res.statusCode).toEqual(500);
        expect(res.headers['content-type']).toMatch(/json/);
        expect(res.body).toEqual({ error: 'Failed to generate AI insight' });
    });
});