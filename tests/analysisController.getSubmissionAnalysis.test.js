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

const { getSubmissionAnalysis } = require("../controllers/analysisController");

describe("Unit 3 - AnalysisController.getSubmissionAnalysis", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("valid submission ID renders the returned SubmissionAnalysis", async () => {
    const analysis = {
      submissionId: 1001,
      submission: { submissionId: 1001 },
      detectedErrors: ["teh", "3 + 2 = 6"],
      errorCategories: ["Spelling", "Calculation"],
      diagnosticSummary: "Spelling and calculation errors."
    };

    analysisRepository.findBySubmissionId.mockResolvedValue(analysis);

    const req = { params: { submissionId: "1001" } };
    const res = createResponse();
    const next = jest.fn();

    await getSubmissionAnalysis(req, res, next);

    expect(analysisRepository.findBySubmissionId).toHaveBeenCalledWith(1001);
    expect(res.render).toHaveBeenCalledWith("viewanalysis", {
      title: "Review Analysis",
      analysis,
      availableCategories: [
        "Spelling",
        "Punctuation",
        "Capitalization",
        "Calculation"
      ]
    });
  });

  test("non-existent numeric ID renders the repository fallback analysis", async () => {
    analysisRepository.findBySubmissionId.mockResolvedValue(
      analysisRepository.default_analysis
    );

    const req = { params: { submissionId: "1234" } };
    const res = createResponse();
    const next = jest.fn();

    await getSubmissionAnalysis(req, res, next);

    expect(analysisRepository.findBySubmissionId).toHaveBeenCalledWith(1234);
    expect(res.render).toHaveBeenCalledWith("viewanalysis", {
      title: "Review Analysis",
      analysis: analysisRepository.default_analysis,
      availableCategories: [
        "Spelling",
        "Punctuation",
        "Capitalization"
      ]
    });
  });

  test("empty submission ID renders the default analysis with HTTP 400", async () => {
    const req = { params: { submissionId: "" } };
    const res = createResponse();
    const next = jest.fn();

    await getSubmissionAnalysis(req, res, next);

    expect(analysisRepository.findBySubmissionId).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith("viewanalysis", {
      title: "Review Analysis",
      analysis: analysisRepository.default_analysis,
      availableCategories: [
        "Spelling",
        "Punctuation",
        "Capitalization"
      ]
    });
  });
});