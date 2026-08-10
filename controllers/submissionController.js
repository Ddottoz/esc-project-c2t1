const submissionRepository = require("../repositories/submissionRepository");


async function getSubmissions(req, res, next) {
  try {
    const semesterId = req.params.semesterId;

    const band = String(req.params.band || "").trim();


    const assessmentType = String(req.params.assessmentType || "").trim().replace(/_/g, " ");


    const submissionPage =
      await submissionRepository
        .findBySemesterBandAndAssessmentType(semesterId, band, assessmentType);


    return res.render(
      "submission",
      {
        title: "Submissions",
        submissionPage
      }
    );
  } catch (error) {
    return next(error);
  }
}


module.exports = {
  getSubmissions
};