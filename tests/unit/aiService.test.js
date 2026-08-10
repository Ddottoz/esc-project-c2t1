const { generateStudentInsight } = require('../../services/aiService');
const OpenAI = require('openai');

// Intercept the OpenAI package so no network requests are made
jest.mock('openai');

describe('AIService.generateStudentInsight', () => {
  test('Unit 2.1: Should return AI insights for valid student and grouped assessment data without calling real API', async () => {
    const mockAiResponse = "<p>Student Alex demonstrates strong performance in Writing.</p>";

    // Mock the OpenAI client completion method
    const mockCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: mockAiResponse
          }
        }
      ]
    });

    OpenAI.prototype.chat = {
      completions: {
        create: mockCreate
      }
    };

    // Input data
    const mockStudent = { studentId: '101', firstName: 'Alex' };
    const mockGroupedBySemester = {
      '202501': {
        Math: [{ score: 20, assessmentType: 'Narrative Writing' }]
      }
    };

    const insight = await generateStudentInsight(mockStudent, mockGroupedBySemester);

    // Expected Output Assertions
    expect(insight).toBe(mockAiResponse); // Verifies returned text matches mock output
    expect(mockCreate).toHaveBeenCalledTimes(1); // Verifies API wrapper was invoked correctly
  });
});