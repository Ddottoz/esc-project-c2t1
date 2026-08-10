const express = require("express");


const upload = require("../middleware/upload");
const uploadController = require("../controllers/uploadController");

const router = express.Router();



router.get("/:studentAssessmentId", uploadController.showAllUploads);

router.post(
    "/:studentAssessmentId",
    upload.single("pdf"),
    uploadController.uploadPdf
);

module.exports = router;