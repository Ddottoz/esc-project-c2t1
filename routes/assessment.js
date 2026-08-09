// routes/assessmentRoutes.js
const express = require('express');
const router = express.Router();
const {
    addAssessment,
    editAssessment,
    removeAssessment,
    getAssessment,
    getAssessments,
    publish,
    unpublish,
    renderBandAssessmentsPage
} = require('../controller/assessmentController');

// Template CRUD
router.get('/semBand/:semesterId', getAssessments);              // GET    /?assessmentType=...&band=...
router.get('/:assessmentId', getAssessment);  // GET    //5
router.post('/', addAssessment);                // POST   /
router.put('/:assessmentId', editAssessment);  // PUT    //5
router.delete('/:assessmentId', removeAssessment);


// Publishing
router.post('/:assessmentId/publish', publish); // POST   //5/publish
router.post('/:assessmentId/unpublish', unpublish);


// GET /semesters/2/bands/A/

router.get('/semBand/:semesterId/:band/assessments/view', renderBandAssessmentsPage);

module.exports = router;