class SubmissionAnalysis {
  constructor({
    submission,
    diagnosticSummary,
    isAccepted,
    detectedErrors = [],
    errorCategories = []
  }) {
    this.submission = submission;
    this.submissionId = submission.submissionId;
    this.diagnosticSummary = diagnosticSummary;
    this.isAccepted = Boolean(isAccepted);
    this.detectedErrors = detectedErrors;
    this.errorCategories = errorCategories;
  }

  updateAnalysis({ diagnosticSummary, detectedErrors, errorCategories, rubricScores, totalScore }) {
    this.diagnosticSummary = diagnosticSummary;
    this.detectedErrors = detectedErrors;
    this.errorCategories = errorCategories;
    this.isAccepted = false;
  }

  approve() {
    this.isAccepted = true;
    return true;
  }
}

module.exports = SubmissionAnalysis;
