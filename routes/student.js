const express = require('express');
const router = express.Router();
const StudentModel = require('../models/student');

// helper function to validate contact persons payload
function validateContactPersons(contactPersons) {
    const contacts = contactPersons || [];
    if (contacts.length === 0) {
        return 'At least 1 contact person is required.';
    }
    if (contacts.length > 2) {
        return 'A maximum of 2 contact persons is allowed.'
    }
    const primaryCount = contacts.filter((c) => c.isPrimary).length;
    if (primaryCount !== 1) {
        return 'Exactly 1 contact person must be marked as primary.';
    }
    return null;
}

// fetches all student records
router.get('/', async (req, res) => {
    try {
        const students = await StudentModel.getAllStudents();
        res.json(students || []);
  } catch (err) {
        console.error('Error fetching students:', err);
        res.status(500).json({ error: 'Failed to retrieve students.' });
  }
})

// fetches a single student record
router.get('/:studentId', async (req, res) => {
    try {
        const studentId = Number(req.params.studentId);

        if (isNaN(studentId)) {
            return res.status(400).json({error: 'Invalid student ID provided.'})
        }

        const student = await StudentModel.getStudentById(studentId);
        if (!student) {
            if (!student) return res.status(404).json({error: 'Student not found'});
        }

        res.json(student);
    } catch(err) {
        console.error('Error fetching student:', err);
        res.status(500).json({error: 'Failed to retrieve student details.'});
    }  
})

// creates new student record
router.post('/', async (req, res) => {
    const { firstName, lastName, nric, dateOfBirth, centreId, educatorId, currentBand, semesterId, contactPersons} = req.body;

    // payload validation
    if (!firstName || !lastName || !nric || !dateOfBirth || !centreId || !educatorId || !currentBand || !semesterId) {
        return res.status(400).json({error: 'Name, NRIC, date of birth, centre, educator, band and semester are required'});
    }

    const contactError = validateContactPersons(contactPersons);
    if (contactError) return res.status(400).json({error: contactError});

    try {
        // avoid duplicates
        const alreadyExists = await StudentModel.nricExists(nric);
        if (alreadyExists) {
            return res.status(409).json({error: 'A student with this NRIC already exists.'});
        }

        const newId = await StudentModel.addStudent(req.body);
        res.status(201).json({studentId: newId});
    } catch(err) {
        console.error('Error adding student:', err);
        res.status(500).json({error: err.message || 'Failed to add student.'});
    }
})

// updates an existing student record
router.put('/:studentId', async (req, res) => {
    const studentId = Number(req.params.studentId);
    if (isNaN(studentId)) {
        return res.status(400).json({error: 'Invalid student ID provided.'});
    }

    const {nric, ...updateData} = req.body  // strip nric out
    const {centreId, educatorId, currentBand, semesterId, contactPersons} = updateData;

    if (!centreId || !educatorId || !currentBand || !semesterId) {
        return res.status(400).json({error: 'Centre, educator, band and semester are required.'});
    }

    const contactError = validateContactPersons(contactPersons);
    if (contactError) return res.status(400).json({error: contactError});

    try {
        const updated = await StudentModel.updateStudent(studentId, updateData);
        if (!updated) return res.status(404).json({error: 'Student not found'});
        res.json({studentId});
    } catch(err) {
        console.error('Error updating student:', err);
        res.status(500).json({error: err.message || 'Failed to update student.'});
    }
})

// deletes a student record by id
router.delete('/:studentId', async (req, res) => {
    try {
        const studentId = Number(req.params.studentId);
        if (isNaN(studentId)) {
            return res.status(400).json({error: 'Invalid student ID provided.'});
        }

        const deleted = await StudentModel.deleteStudent(studentId);
        if (!deleted) return res.status(404).json({error: 'Student not found.'});
        res.json({studentId});
    } catch(err) {
        console.error('Error deleting student:', err);
        res.status(500).json({error: 'Failed to delete student.'});
    }
})

// fetches a student's full progress (all sems, components, bands, remarks)
router.get('/:studentId/progress', async (req, res) => {
    try {
        const studentId = Number(req.params.studentId);

        if (isNaN(studentId)) {
            return res.status(400).json({error: 'Invalid student ID provided.'});
        }

        const progressData = await StudentModel.getProgressData(studentId);
        if (!progressData) {
            return res.status(404).json({error: 'Student not found.'});
        }

        res.json(progressData);
    } catch (err) {
        console.error('Error fetching student progress:', err);
        res.status(500).json({error: 'Failed to retrieve student progress.'});
    }
})

module.exports = router;