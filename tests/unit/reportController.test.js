process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
const reportController = require('../../controllers/reportController');
const StudentModel = require('../../models/student');
const aiService = require('../../services/aiService');

jest.mock('../../models/student');
jest.mock('../../services/aiService');
jest.mock('../../models/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn().mockResolvedValue({
    release: jest.fn()
  })
}));

describe('ReportController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { id: '101' },
      query: { startSem: '202501', endSem: '202502' }
    };
    res = {
      render: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('getStudentReport', () => {
    test('Unit 3.1: Should render "report" view with grouped assessments and formatted semesters', async () => {
      const mockReportData = {
        student: { studentId: '101', enrolmentDate: '2024-01-15' },
        availableSemesters: ['202501', '202502'],
        assessments: [
          { semesterId: '202501', component: 'Writing', score: 20 },
          { semesterId: '202501', component: 'Fluency', score: 18 }
        ]
      };

      StudentModel.generateReport.mockResolvedValue(mockReportData);

      await reportController.getStudentReport(req, res);

      expect(StudentModel.generateReport).toHaveBeenCalledWith('101', '202501', '202502');
      expect(res.render).toHaveBeenCalledWith(
        'report',
        expect.objectContaining({
          student: expect.objectContaining({ formattedEnrolmentDate: '15 Jan 2024' }),
          groupedBySemester: {
            '202501': {
              Writing: [{ semesterId: '202501', component: 'Writing', score: 20 }],
              Fluency: [{ semesterId: '202501', component: 'Fluency', score: 18 }]
            }
          },
          availableSemesters: [
            { raw: '202501', label: '2025 Sem 1' },
            { raw: '202502', label: '2025 Sem 2' }
          ]
        })
      );
    });

    test('Unit 3.2: Should render "error" view with 404 when report data is null', async () => {
      StudentModel.generateReport.mockResolvedValue(null);

      await reportController.getStudentReport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.render).toHaveBeenCalledWith('error', {
        message: 'Student report not found',
        error: { status: 404 }
      });
    });

    test('Unit 3.3: Should render "error" view with 500 status on unexpected failure', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        StudentModel.generateReport.mockRejectedValue(new Error('Database Connection Error'));

        await reportController.getStudentReport(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.render).toHaveBeenCalledWith('error', expect.objectContaining({
            message: 'Failed to generate student report'
        }));

        // Restore original console.error
        consoleSpy.mockRestore();
    });
  });
});