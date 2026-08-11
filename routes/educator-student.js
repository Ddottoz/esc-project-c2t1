const express = require('express');
const router = express.Router();
const StudentModel = require('../models/student');

// GET /api/educators/:educatorId/students - an educator's own students, one call
router.get('/:educatorId/students', async (req, res) => {
    try {
        const educatorId = Number(req.params.educatorId);

        // Validate that educatorId is a valid number
        if(isNaN(educatorId)) {
            return res.status(400).json({error: 'Invalid educator ID provided.'})
        }

        const students = await StudentModel.getStudentsByEducator(educatorId);

        // returns 200 ok with student/empty array
        return res.json(students || []);
    } catch(err) {
        // forward error to Express global error handler/send 500 error response
        console.error('Error fetching students by educator:', err);
        return res.status(500).json({error: 'Failed to retrieve students for the specified educator.'})
    }
})

module.exports = router;