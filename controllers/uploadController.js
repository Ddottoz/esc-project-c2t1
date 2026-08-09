const uploadService = require("../services/uploadService");

async function showAllUploads(req, res) {

    try {
    
        const files = await uploadService.getAllUploads();

        res.render("upload", {
            files: files,
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
        console.log(req.body.comment);
        await uploadService.uploadPdf(req.file, req.body.comment, 0);
        res.redirect("/upload");

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