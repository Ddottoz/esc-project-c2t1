var express = require('express');
var router = express.Router();
var reportController = require('../controllers/reportController');

router.get('/student/:id', reportController.getStudentReport);
router.get('/student/:id/ai-insight', reportController.generateAiInsight); // New endpoint

module.exports = router;