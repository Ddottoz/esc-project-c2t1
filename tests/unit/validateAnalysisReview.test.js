const {
  validateAnalysisReview
} = require("../../controllers/analysisController");

describe("validateAnalysisReview", () => {
  test("returns no errors when analysis is valid", () => {
    const validAnalysis = {
      diagnosticSummary: "Spelling and calculation errors.",
      detectedErrors: ["teh", "3 + 2 = 6"],
      errorCategories: ["Spelling", "Calculation"],
      mark: "15"
    };

    const errors = validateAnalysisReview(validAnalysis);

    expect(errors).toEqual([]);
  });

  test("returns errors when analysis is invalid", () => {
    const invalidAnalysis = {
      diagnosticSummary: "",
      detectedErrors: ["teh"],
      errorCategories: [""],
      mark: "abc"
    };

    const errors = validateAnalysisReview(invalidAnalysis);

    expect(errors).toContain("Diagnostic summary is required.");
    expect(errors).toContain("Error category 1 is required.");
    expect(errors).toContain("Mark must be a number.");
  });
});