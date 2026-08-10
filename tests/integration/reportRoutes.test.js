const request = require('supertest');
const app = require('../../app'); 
const db = require('../../models/db'); // Real DB pool

// Mock only external third-party APIs (e.g. DeepSeek/OpenAI)
jest.mock('../../services/aiService', () => ({
  generateStudentInsight: jest.fn().mockResolvedValue('Mocked AI Insight')
}));

describe('Report Routes Integration Tests', () => {

  // Close DB pool after all integration tests finish so Jest exits cleanly
  afterAll(async () => {
    if (db && db.end) {
      await db.end();
    }
  });

  test('GET /reports/student/:id - Integrates Router, Controller, and Model', async () => {
    // Executes the real reportController.getStudentReport and real StudentModel
    const res = await request(app)
      .get('/reports/student/101')
      .query({ startSem: '202501', endSem: '202502' });

    expect(res.statusCode).toEqual(200);
    // Verify actual HTML rendered or data structure returned from DB
    expect(res.text).toContain('101'); 
  });

  test('GET /reports/student/:id/ai-insight - Integrates Router and Controller with mocked External API', async () => {
    const res = await request(app).get('/reports/student/101/ai-insight');

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ aiInsight: 'Mocked AI Insight' });
  });
});