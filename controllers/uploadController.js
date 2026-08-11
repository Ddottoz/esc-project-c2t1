const uploadService = require("../services/uploadService");
const analysisRepository = require("../repositories/analysisRepository");

async function showAllUploads(req, res) {

    try {
        const studentAssessmentId = req.params.studentAssessmentId;
        const files = await uploadService.getAllUploads(studentAssessmentId);
        const analysis = await analysisRepository.findBySubmissionId(studentAssessmentId);

        res.render("upload", {
            studentAssessmentId: studentAssessmentId,
            files: files,
            analysis: analysis,
            message: req.query.message || ""
        });

    }
    catch(err) {

        console.error(err);
        res.status(500).send("Failed to load uploads");

    }

}

async function uploadPdf(req, res) {

    try {

        if (!req.file) {
            return res.status(400).send("No PDF uploaded");
        }
        const studentAssessmentId = req.params.studentAssessmentId;
        await uploadService.createAssessmentSubmission(studentAssessmentId, req.file, 1);
        res.redirect("/upload/" + studentAssessmentId);

    } catch (error) {

        console.error("PDF upload/analysis error:", error);

        res.status(500).send(
            "PDF uploaded, but analysis failed"
        );
    }

}

module.exports = {
    showAllUploads,
    uploadPdf
};