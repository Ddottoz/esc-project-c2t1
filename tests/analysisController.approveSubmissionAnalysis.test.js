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

const { approveSubmissionAnalysis } = require("../controllers/analysisController");

describe("Unit 6 - AnalysisController.approveSubmissionAnalysis", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("valid ID and mark approve successfully", async () => {
    analysisRepository.approve.mockResolvedValue(true);

    const req = {
      params: { submissionId: "1001" },
      body: { mark: "20" }
    };

    const res = createResponse();
    const next = jest.fn();

    await approveSubmissionAnalysis(req, res, next);

    expect(analysisRepository.approve).toHaveBeenCalledWith(1001, 20);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      isAccepted: true
    });
  });

  test("alphabetic submission ID is rejected", async () => {
    const req = {
      params: { submissionId: "abcde" },
      body: { mark: "20" }
    };

    const res = createResponse();
    const next = jest.fn();

    await approveSubmissionAnalysis(req, res, next);

    expect(analysisRepository.approve).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: "Cant approve edits for unknown submissions"
    });
  });

  test("empty submission ID is rejected", async () => {
    const req = {
      params: { submissionId: "" },
      body: { mark: "20" }
    };

    const res = createResponse();
    const next = jest.fn();

    await approveSubmissionAnalysis(req, res, next);

    expect(analysisRepository.approve).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: "Cant approve edits for unknown submissions"
    });
  });

  test("valid ID without a mark is rejected before repository approval", async () => {
    const req = {
      params: { submissionId: "1001" },
      body: {}
    };

    const res = createResponse();
    const next = jest.fn();

    await approveSubmissionAnalysis(req, res, next);

    expect(analysisRepository.approve).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: "Enter a valid mark before approving."
    });
  });
});