const request = require('supertest');
const express = require('express');
const reportRouter = require('../../routes/report');
const reportController = require('../../controllers/reportController');

jest.mock('../../controllers/reportController');

const app = express();
app.use(express.json());
app.use('/reports', reportRouter);

describe('Report Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /reports/student/:id -> reportController.getStudentReport', async () => {
    reportController.getStudentReport.mockImplementation((req, res) => res.status(200).send('OK'));

    const res = await request(app).get('/reports/student/101?startSem=202501&endSem=202502');

    expect(res.statusCode).toEqual(200);
    expect(reportController.getStudentReport).toHaveBeenCalled();
  });

  test('GET /reports/student/:id/ai-insight -> reportController.generateAiInsight', async () => {
    reportController.generateAiInsight.mockImplementation((req, res) =>
      res.status(200).json({ aiInsight: 'Sample Insight' })
    );

    const res = await request(app).get('/reports/student/101/ai-insight');

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ aiInsight: 'Sample Insight' });
    expect(reportController.generateAiInsight).toHaveBeenCalled();
  });
});