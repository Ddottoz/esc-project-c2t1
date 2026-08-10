const SubmissionAnalysis = require("../models/SubmissionAnalysis");

describe("Unit 1 - SubmissionAnalysis.updateAnalysis", () => {
  test("updates detected errors, categories and diagnostic summary", () => {
    const analysis = new SubmissionAnalysis({
      submission: { submissionId: "1001" },
      diagnosticSummary: "Previous summary",
      isAccepted: true,
      detectedErrors: ["old error"],
      errorCategories: ["Old category"]
    });

    const result = analysis.updateAnalysis({
      detectedErrors: ["teh", "3 + 2 = 6"],
      errorCategories: ["Spelling", "Calculation"],
      diagnosticSummary: "Spelling and calculation errors."
    });

    expect(result).toBeUndefined();
    expect(analysis.submissionId).toBe("1001");
    expect(analysis.detectedErrors).toEqual(["teh", "3 + 2 = 6"]);
    expect(analysis.errorCategories).toEqual(["Spelling", "Calculation"]);
    expect(analysis.diagnosticSummary).toBe("Spelling and calculation errors.");
    expect(analysis.isAccepted).toBe(false);
  });

  test("allows errors, categories and summary to be cleared at model level", () => {
    const analysis = new SubmissionAnalysis({
      submission: { submissionId: "1001" },
      diagnosticSummary: "Previous summary",
      isAccepted: false,
      detectedErrors: ["old error"],
      errorCategories: ["Old category"]
    });

    const result = analysis.updateAnalysis({
      detectedErrors: [],
      errorCategories: [],
      diagnosticSummary: ""
    });

    expect(result).toBeUndefined();
    expect(analysis.detectedErrors).toEqual([]);
    expect(analysis.errorCategories).toEqual([]);
    expect(analysis.diagnosticSummary).toBe("");
  });
});

describe("Unit 2 - approval state", () => {
  test("SubmissionAnalysis.approve changes isAccepted from false to true", () => {
    const analysis = new SubmissionAnalysis({
      submission: { submissionId: "1001" },
      diagnosticSummary: "Spelling and calculation errors.",
      isAccepted: false,
      detectedErrors: ["teh"],
      errorCategories: ["Spelling"]
    });

    const result = analysis.approve();

    expect(result).toBe(true);
    expect(analysis.isAccepted).toBe(true);
  });
});