const SubmissionAnalysis = require("../../models/SubmissionAnalysis");

describe("View Analysis - Update", () => {
  test("updates analysis details and resets isAccepted to false", () => {
    const submission = {
      submissionId: 1001
    };

    const analysis = new SubmissionAnalysis({
      submission,
      diagnosticSummary: "Original summary",
      isAccepted: true,
      detectedErrors: ["teh"],
      errorCategories: ["Spelling"]
    });

    analysis.updateAnalysis({
      diagnosticSummary: "Updated summary",
      detectedErrors: ["recieve"],
      errorCategories: ["Spelling"]
    });

    expect(analysis.diagnosticSummary).toBe("Updated summary");
    expect(analysis.detectedErrors).toEqual(["recieve"]);
    expect(analysis.errorCategories).toEqual(["Spelling"]);
    expect(analysis.isAccepted).toBe(false);
  });

  test("updates analysis with empty values and resets isAccepted to false", () => {
    const submission = {
      submissionId: 1001
    };

    const analysis = new SubmissionAnalysis({
      submission,
      diagnosticSummary: "Original summary",
      isAccepted: true,
      detectedErrors: ["teh"],
      errorCategories: ["Spelling"]
    });

    analysis.updateAnalysis({
      diagnosticSummary: "",
      detectedErrors: [],
      errorCategories: []
    });

    expect(analysis.diagnosticSummary).toBe("");
    expect(analysis.detectedErrors).toEqual([]);
    expect(analysis.errorCategories).toEqual([]);
    expect(analysis.isAccepted).toBe(false);
  });
});