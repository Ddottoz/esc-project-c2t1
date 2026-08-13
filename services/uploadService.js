const uploadModel = require("../models/upload");
const llmAdapter = require("../models/llmAdapter");
const errorsModel = require("../models/error");

async function createAssessmentSubmission(studentAssessmentId, file, enableAnalysis=1) {

    const filePath = "/public/uploads/" + file.filename;
    const analysisDisabledText = '{"transcription":"He ran.\\nFox hunts.","errors":[{"type":"Capitalization","original":"he ran.","correction":"He ran."}], "diagnosticSummary":"Test summary."}';
;

    const analysis = enableAnalysis ? await llmAdapter.analyzePdf(
        file.path
    ) : JSON.parse(analysisDisabledText);;

    await errorsModel.deleteErrors(studentAssessmentId);

    const result = await uploadModel.createAssessmentSubmission(
        studentAssessmentId,
        new Date(),
        filePath
    );

    for (const error of analysis.errors) {
        await errorsModel.insertError(
            studentAssessmentId,
            error.original,
            error.type
        );
    }
    await uploadModel.createDiagnosticSummary(studentAssessmentId, analysis.diagnosticSummary);
    await uploadModel.setAssessmentAssigned(studentAssessmentId);


    return result;

}

async function getAllUploads(submissionId) {

    return uploadModel.getAllUploads(submissionId);

}
async function getAssessmentInfoFromId(studentAssessmentId){
    return uploadModel.getAssessmentInfoFromId(studentAssessmentId);
}

module.exports = {
    createAssessmentSubmission,
    getAllUploads,
    getAssessmentInfoFromId
};