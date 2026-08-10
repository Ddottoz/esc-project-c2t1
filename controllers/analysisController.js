const analysisRepository = require("../repositories/analysisRepository");

const DEFAULT_ERROR_CATEGORIES = [
  "Spelling",
  "Punctuation",
  "Capitalization"
];

const {
  default_analysis,
  default_submission
} = require("../repositories/analysisRepository");


async function getSubmissionAnalysis(req, res, next) {
  try {
    const submissionId = parseSubmissionId(req.params.submissionId);
    const analysis = await analysisRepository.findBySubmissionId(submissionId);

    const availableCategories =
      uniqueCategoriesIgnoreCase([
        ...DEFAULT_ERROR_CATEGORIES,
        ...analysis.errorCategories
      ]);

    return res.render("viewanalysis", {
      title: "Review Analysis",
      analysis,
      availableCategories
    });
  } catch (error) {
    return res.status(error.status || 500).render(
      "viewanalysis",
      {
        title: "Review Analysis",

        analysis: default_analysis,

        availableCategories:
          DEFAULT_ERROR_CATEGORIES
      });
  }
}

async function updateSubmissionAnalysis(req, res, next) {
  try {
    const submissionId = parseSubmissionId(req.params.submissionId);

    const validationErrors = validateAnalysisReview(req.body);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        ok: false,
        errors: validationErrors
      });
    }

    const analysis = await analysisRepository.updateAnalysis(submissionId, req.body);

    return res.json({
      ok: true,
      analysis
    });
  } catch (error) {
    console.error("Error saving analysis:", error);

    return res
      .status(error.status || 500)
      .json({
        ok: false,
        message:
          error.message ||
          "Unable to save analysis."
      });
  }
}

async function approveSubmissionAnalysis(req, res, next) {
  try {
    const submissionId = parseSubmissionId(req.params.submissionId);

    if (
      req.body.mark === undefined ||
      String(req.body.mark).trim() === "" ||
      !isValidMark(req.body.mark)
    ) {
      return res.status(400).json({
        ok: false,
        message: "Enter a valid mark before approving."
      });
    }

    const approved = await analysisRepository.approve(submissionId, Number(req.body.mark));

    if (!approved) {
      return res.status(404).json({
        ok: false,
        message: "Submission analysis not found."
      });
    }

    return res.json({ ok: true, isAccepted: true });
  } catch (error) {
    console.error("Error saving analysis:", error);

    return res
      .status(error.status || 500)
      .json({
        ok: false,
        message:
          "Cant approve edits for unknown submissions"
      });
  }
}

function uniqueCategoriesIgnoreCase(categories) {
  const seenCategories = new Set();

  return categories.filter(
    function (category) {
      const cleanCategory = String(category || "").trim();

      const categoryKey = cleanCategory.toLowerCase();


      if (
        cleanCategory === "" ||
        seenCategories.has(categoryKey)
      ) {
        return false;
      }


      seenCategories.add(categoryKey);

      return true;
    }
  );
}


function validateAnalysisReview(body) {
  const errors = [];

  if (typeof body.diagnosticSummary !== "string" || body.diagnosticSummary.trim() === "") {
    errors.push("Diagnostic summary is required.");
  }

  if (!Array.isArray(body.detectedErrors)) {
    errors.push("Detected errors must be an array.");
  }

  if (!Array.isArray(body.errorCategories)) {
    errors.push("Error categories must be an array.");
  }

  if (
    Array.isArray(body.detectedErrors) &&
    Array.isArray(body.errorCategories) &&
    body.detectedErrors.length !== body.errorCategories.length
  ) {
    errors.push("Each detected error must have one error category.");
  }

  if (
    Array.isArray(body.detectedErrors) &&
    Array.isArray(body.errorCategories) &&
    body.detectedErrors.length === body.errorCategories.length
  ) {
    body.detectedErrors.forEach(function (detectedError, index) {
      const cleanDetectedError = String(detectedError || "").trim();
      const cleanErrorCategory = String(body.errorCategories[index] || "").trim();

      if (cleanDetectedError !== "" && cleanErrorCategory === "") {
        errors.push(`Error category ${index + 1} is required.`);
      }

      if (cleanDetectedError === "" && cleanErrorCategory !== "") {
        errors.push(`Detected error ${index + 1} is required.`);
      }
    });
  }

  if (
    body.mark !== undefined &&
    String(body.mark).trim() !== "" &&
    !isValidMark(body.mark)
  ) {
    errors.push("Mark must be a number.");
  }

  return errors;
}

function isValidMark(mark) {
  const cleanMark = String(mark).trim();


  return (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleanMark) && Number.isFinite(Number(cleanMark)));
}

function parseSubmissionId(rawId) {
  const error = new Error("Invalid submission ID.");
  error.status = 400;

  if (typeof rawId !== "string")
  {
    rawId = "0"
  }

  for(const char of rawId)
  {
    if (char < '0' || char > '9')
    {
      rawId = "0";
    }
  }
  const submissionId = Number.parseInt(rawId, 10);

  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    throw error;
  }

  return submissionId;
}

module.exports = {
  getSubmissionAnalysis,
  updateSubmissionAnalysis,
  approveSubmissionAnalysis,
  validateAnalysisReview
};