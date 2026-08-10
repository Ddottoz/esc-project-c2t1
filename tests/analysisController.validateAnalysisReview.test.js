jest.mock("../repositories/analysisRepository", () => ({
  findBySubmissionId: jest.fn(),
  updateAnalysis: jest.fn(),
  approve: jest.fn(),
  default_submission: { submissionId: 0 },
  default_analysis: {
    submissionId: 0,
    submission: { submissionId: 0 },
    diagnosticSummary: "Submission doesnt exist",
    isAccepted: false,
    detectedErrors: [],
    errorCategories: []
  }
}));

const analysisRepository = require("../repositories/analysisRepository");

function createResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const { validateAnalysisReview } = require("../controllers/analysisController");

describe("Unit 4 - AnalysisController.validateAnalysisReview", () => {
  test("matching errors/categories with a summary are valid", () => {
    const result = validateAnalysisReview({
      detectedErrors: ["teh", "3 + 2 = 6"],
      errorCategories: ["Spelling", "Calculation"],
      diagnosticSummary: "Spelling and calculation"
    });

    expect(result).toEqual([]);
  });

  test("empty errors/categories with an empty summary are invalid in the current project", () => {
    const result = validateAnalysisReview({
      detectedErrors: [],
      errorCategories: [],
      diagnosticSummary: ""
    });

    expect(result).toEqual(["Diagnostic summary is required."]);
  });

  test("two detected errors with only one category are invalid", () => {
    const result = validateAnalysisReview({
      detectedErrors: ["teh", "3 + 2 = 6"],
      errorCategories: ["Spelling"],
      diagnosticSummary: "Spelling and calculation"
    });

    expect(result).toContain(
      "Each detected error must have one error category."
    );
  });

  test("categories without corresponding detected errors are invalid", () => {
    const result = validateAnalysisReview({
      detectedErrors: [],
      errorCategories: ["Spelling", "Calculation"],
      diagnosticSummary: "Spelling and calculation"
    });

    expect(result).toContain(
      "Each detected error must have one error category."
    );
  });
});