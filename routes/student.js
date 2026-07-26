const express = require('express');
const router = express.Router();
const StudentModel = require('../models/student');

router.get('/', async (req, res) => {
    const students = await StudentModel.getAllStudents();
    res.json(students);
})

router.get('/:id', async (req, res) => {
    const student = await StudentModel.getStudentById(req.params.id);
    if (!student) return res.status(404).json({error: 'Student not found'});
    res.json(student);
})

router.post('/', async (req, res) => {
    const { studentId, studentName, dateOfBirth, centreId, teacherId, contactPersons} = req.body;

    if (!studentId || !studentName || !dateOfBirth || !centreId || !teacherId) {
        return res.status(404).json({error: 'Student ID, name, date of birth, centre and teacher are required'});
    }

    const primaryCount = (contactPersons || []).filter((c) => c.isPrimary).length;
    if (primaryCount > 1) {
        return res.status(400).json({error: 'Only 1 contact person can be marked as primary.'});
    }
    
    // UC4 alt flow: studentId alr exists
    const alreadyExists = await StudentModel.studentExists(studentId);
    if (alreadyExists) {
        return res.status(409).json({error: 'A student with this ID already exists.'});
    } 

    const newId = await StudentModel.addStudent(req.body);
    res.status(201).json({studentId: newId});
})

router.put('/:id', async (req, res) => {
    if (!req.body.studentName || !req.body.dateOfBirth) {
        return res.status(400).json({error: 'Student name and date of birth are required'});
    }

    const primaryCount = (req.body.contactPersons || []).filter((c) => c.isPrimary).length;
    if (primaryCount > 1) {
        return res.status(400).json({error: 'Only 1 contact person can be marked as primary.'});
    }

    const updated = await StudentModel.updateStudent(req.params.id, req.body);
    if (!updated) return res.status(404).json({error: 'Student not found'});
    res.json({studentId: req.params.id});
})

module.exports = router;