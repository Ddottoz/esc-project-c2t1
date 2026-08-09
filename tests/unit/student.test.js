const StudentModel = require('../../models/student');
const pool = require('../../models/db');

// Mock the MySQL pool dependency
jest.mock('../../models/db', () => ({
  query: jest.fn()
}));

describe('StudentModel.generateReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Unit 1.1: Should successfully generate report with valid student and semester range', async () => {
    const mockStudent = {
      studentId: '101',
      firstName: 'Alex',
      enrolmentDate: '2024-01-15'
    };
    const mockSemesters = [{ semesterId: '202502' }, { semesterId: '202501' }];
    const mockAssessments = [
      {
        studentAssessmentId: 1,
        semesterId: '202501',
        score: 20,
        component: 'Writing',
        assessmentType: 'Narrative Writing',
        passingMark: 20,
        assessmentBand: 'A1'
      }
    ];

    pool.query
      .mockResolvedValueOnce([[mockStudent]]) // 1. getStudentById
      .mockResolvedValueOnce([mockSemesters]) // 2. semRows
      .mockResolvedValueOnce([mockAssessments]); // 3. assessments

    const result = await StudentModel.generateReport('101', '202501', '202502');

    expect(result).toHaveProperty('student');
    expect(result.student.studentId).toBe('101');
    expect(result.availableSemesters).toEqual(['202502', '202501']);
    expect(result.assessments).toHaveLength(1);
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test('Unit 1.2: Should throw an error if student profile is not found', async () => {
    // Mock empty response for getStudentById
    pool.query.mockResolvedValueOnce([[]]);

    await expect(
      StudentModel.generateReport('999', '202501', '202502')
    ).rejects.toThrow('Student Profile Not Found');
  });

  test('Unit 1.3: Should use default active semester range when filters are not passed', async () => {
    const mockStudent = { studentId: '101', firstName: 'Alex' };
    const mockSemesters = [{ semesterId: '202502' }, { semesterId: '202501' }];

    pool.query
      .mockResolvedValueOnce([[mockStudent]])
      .mockResolvedValueOnce([mockSemesters])
      .mockResolvedValueOnce([[]]);

    const result = await StudentModel.generateReport('101', null, null);

    expect(result.availableSemesters).toEqual(['202502', '202501']);
    // Check that activeStartSem defaulted to '202501' and activeEndSem to '202502'
    expect(pool.query).toHaveBeenNthCalledWith(
      3,
      expect.any(String),
      ['101', '202501', '202502']
    );
  });
});