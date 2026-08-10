const express = require("express");
const analysisController = require("../controllers/analysisController");

const router = express.Router();

router.get("/:submissionId", analysisController.getSubmissionAnalysis);
router.put("/:submissionId", analysisController.updateSubmissionAnalysis);
router.patch("/:submissionId/approve", analysisController.approveSubmissionAnalysis);

module.exports = router;
