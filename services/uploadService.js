const uploadModel = require("../models/upload");
const llmAdapter = require("../models/llmAdapter");

async function uploadPdf(file, comment, enableAnalysis=1) {

    const filePath = "/public/uploads/" + file.filename;
    const analysisDisabledText = "Analysis disabled.";
    const result = await uploadModel.uploadPdf(
        file.originalname,
        file.filename,
        filePath,
        comment
    );

    const analysis = enableAnalysis ? await llmAdapter.analyzePdf(
        file.path
    ) : analysisDisabledText;

    await uploadModel.updateAnalysis(
        result.insertId,
        analysis
    );

    return result;

}

async function getAllUploads() {

    return uploadModel.getAllUploads();

}

module.exports = {
    uploadPdf,
    getAllUploads
};