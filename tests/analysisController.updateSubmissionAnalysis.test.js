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

const { updateSubmissionAnalysis } = require("../controllers/analysisController");

describe("Unit 5 - AnalysisController.updateSubmissionAnalysis", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("valid edits call the repository and return the updated analysis", async () => {
    const body = {
      detectedErrors: ["teh", "3 + 2 = 6"],
      errorCategories: ["Spelling", "Calculation"],
      diagnosticSummary: "Spelling and calculation errors."
    };

    const updatedAnalysis = {
      submissionId: 1001,
      detectedErrors: body.detectedErrors,
      errorCategories: body.errorCategories,
      diagnosticSummary: body.diagnosticSummary,
      isAccepted: false
    };

    analysisRepository.updateAnalysis.mockResolvedValue(updatedAnalysis);

    const req = {
      params: { submissionId: "1001" },
      body
    };

    const res = createResponse();
    const next = jest.fn();

    await updateSubmissionAnalysis(req, res, next);

    expect(analysisRepository.updateAnalysis).toHaveBeenCalledWith(1001, body);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      analysis: updatedAnalysis
    });
  });

  test("empty errors/categories with an empty summary are rejected by current validation", async () => {
    const req = {
      params: { submissionId: "1001" },
      body: {
        detectedErrors: [],
        errorCategories: [],
        diagnosticSummary: ""
      }
    };

    const res = createResponse();
    const next = jest.fn();

    await updateSubmissionAnalysis(req, res, next);

    expect(analysisRepository.updateAnalysis).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      errors: ["Diagnostic summary is required."]
    });
  });

  test("invalid submission ID does not call the repository and returns HTTP 400", async () => {
    const req = {
      params: { submissionId: "abcde" },
      body: {
        detectedErrors: ["teh", "3 + 2 = 6"],
        errorCategories: ["Spelling", "Calculation"],
        diagnosticSummary: "Spelling and calculation errors."
      }
    };

    const res = createResponse();
    const next = jest.fn();

    await updateSubmissionAnalysis(req, res, next);

    expect(analysisRepository.updateAnalysis).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: "Invalid submission ID."
    });
  });
});