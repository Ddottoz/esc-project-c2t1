const express = require("express");

const submissionController = require("../controllers/submissionController");

const router = express.Router();


router.get("/:semesterId/:band/:assessmentType", submissionController.getSubmissions);


module.exports = router;