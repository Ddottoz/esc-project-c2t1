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
} = require('../controllers/assessmentController');

// Template CRUD
router.get('/semBand/:semesterBandId', getAssessments);              // GET    /?assessmentType=...&band=...
router.get('/:assessmentId', getAssessment);  // GET    //5
router.post('/', addAssessment);                // POST   /
router.put('/:assessmentId', editAssessment);  // PUT    //5
router.delete('/:assessmentId', removeAssessment);


// Publishing
router.post('/:assessmentId/publish', publish); // POST   //5/publish
router.post('/:assessmentId/unpublish', unpublish);


// GET /semesters/2/bands/A/
router.get('/:semesterBandId/view', renderBandAssessmentsPage);

module.exports = router;