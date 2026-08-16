const SubmissionAnalysis = require("../../models/SubmissionAnalysis");

describe("View Analysis - Approve", () => {
  test("sets isAccepted to true when analysis is approved", () => {
    const submission = {
      submissionId: 1001
    };

    const analysis = new SubmissionAnalysis({
      submission,
      diagnosticSummary: "Student made several spelling errors.",
      isAccepted: false,
      detectedErrors: ["teh"],
      errorCategories: ["Spelling"]
    });

    const result = analysis.approve();

    expect(result).toBe(true);
    expect(analysis.isAccepted).toBe(true);
  });

  test("keeps isAccepted true when an already approved analysis is approved again", () => {
    const submission = {
      submissionId: 1001
    };

    const analysis = new SubmissionAnalysis({
      submission,
      diagnosticSummary: "Student made several spelling errors.",
      isAccepted: true,
      detectedErrors: ["teh"],
      errorCategories: ["Spelling"]
    });

    const result = analysis.approve();

    expect(result).toBe(true);
    expect(analysis.isAccepted).toBe(true);
  });
});