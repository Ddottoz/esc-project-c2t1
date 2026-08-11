const uploadModel = require("../models/upload");
const llmAdapter = require("../models/llmAdapter");
const errorsModel = require("../models/error");

async function createAssessmentSubmission(studentAssessmentId, file, enableAnalysis=1) {

    const filePath = "/public/uploads/" + file.filename;
    const analysisDisabledText = '{"transcription":"He ran.\\nFox hunts.","errors":[{"type":"Capitalization","original":"he ran.","correction":"He ran."}], "diagnosticSummary":"Test summary."}';
;
    const result = await uploadModel.createAssessmentSubmission(
        studentAssessmentId,
        new Date(),
        filePath
    );

    const analysis = enableAnalysis ? await llmAdapter.analyzePdf(
        file.path
    ) : JSON.parse(analysisDisabledText);;

    for (const error of analysis.errors) {
        await errorsModel.insertError(
            studentAssessmentId,
            error.original,
            error.type
        );
    }
    await uploadModel.createDiagnosticSummary(studentAssessmentId, analysis.diagnosticSummary);

    return result;

}

async function getAllUploads(submissionId) {

    return uploadModel.getAllUploads(submissionId);

}

module.exports = {
    createAssessmentSubmission,
    getAllUploads
};