const express = require('express');
const router = express.Router();
const {
    createAssessment, updateAssessment, getAssessmentById, getAllAssessmentsFiltered, publishAssessment,
    deleteAssessment, unpublishAssessment
} = require('../models/assessment');

const validBands = ['A1', 'A2', 'A3', 'B4', 'B5', 'B6', 'C7', 'C8', 'C9'];
const validComponents = ['Vocabulary', 'Writing', 'Comprehension', 'PA / Phonics'];
const validAssessmentTypes = [
    'Letter Formation', 'Narrative Writing', 'Exposition Writing',
    'Edit and Diagram 1', 'Edit and Diagram 2', 'Edit and Diagram 3',
    'Comprehension', 'Primary', 'Secondary', 'Picture Naming',
    'Picture Description', 'PA Identification', 'Phonics',
    'Word Reading Accuracy', 'Fluency', 'Word Spelling'
];

function isInteger(value) {
    return Number.isInteger(Number(value)) && value !== '' && value !== null;
}

function isValidWeight(value) {
    if (value === null || value === '' || isNaN(Number(value))) return false;
    const num = Number(value);
    if (num < 0 || num > 999.9999) return false;
    return /^\d{1,3}(\.\d{1,4})?$/.test(String(value));
}

function validateAssessmentBody(body) {
    const { assessmentType, component, band, passingMark, totalMark, weight } = body;

    if (!assessmentType || !component || !band || passingMark === '' || passingMark == null || totalMark === '' || totalMark == null || weight === '' || weight == null) {
        return 'All fields are required';
    }
    if (!validAssessmentTypes.includes(assessmentType)) {
        return `assessmentType must be one of: ${validAssessmentTypes.join(', ')}`;
    }
    if (!validComponents.includes(component)) {
        return `component must be one of: ${validComponents.join(', ')}`;
    }
    if (!validBands.includes(band.toUpperCase())) {
        return `band must be one of: ${validBands.join(', ')}`;
    }
    if (!isInteger(passingMark)) {
        return 'passingMark must be an integer';
    }
    if (!isInteger(totalMark)) {
        return 'totalMark must be an integer';
    }
    if (Number(passingMark) < 0) {
        return 'passingMark cannot be negative';
    }
    if (Number(totalMark) < 0) {
        return 'totalMark cannot be negative';
    }
    if (Number(passingMark) > Number(totalMark)) {
        return 'Passing Mark cannot exceed Total Mark';
    }
    if (!isValidWeight(weight)) {
        return 'weight must be a valid decimal number with up to 4 decimal places and value between 0 and 999.9999';
    }
    return null;
}

// POST /assessments
async function addAssessment(req, res) {
    try {
        const error = validateAssessmentBody(req.body);
        if (error) return res.status(400).json({ message: error });

        const { assessmentType, component, band, passingMark, totalMark, rubrics, semesterId, weight } = req.body;

        const result = await createAssessment(
            { assessmentType, component, band: band.toUpperCase(), passingMark, totalMark, rubrics },
            semesterId,
            weight
        );

        if (!result.success) {
            if (result.reason === 'DUPLICATE_ASSESSMENT_TYPE') {
                return res.status(409).json({ message: 'Assessment type already exists for this band' });
            }
            if (result.reason === 'SEMESTER_BAND_NOT_FOUND') {
                return res.status(404).json({ message: 'No matching band found for this semester' });
            }
            return res.status(500).json({ message: 'Failed to assign weight to assessment' });
        }

        return res.status(201).json({ message: 'Assessment created successfully', assessmentId: result.assessmentId });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to create assessment' });
    }
}

// PUT /assessments/:assessmentId
async function editAssessment(req, res) {
    try {
        const { assessmentId } = req.params;
        const error = validateAssessmentBody(req.body);
        if (error) return res.status(400).json({ message: error });

        const { assessmentType, component, band, passingMark, totalMark, weight, rubrics, semesterId } = req.body;

        const result = await updateAssessment(
            assessmentId,
            { assessmentType, component, band: band.toUpperCase(), passingMark, totalMark, rubrics },
            semesterId,
            weight
        );

        if (!result.success) {
            if (result.reason === 'NOT_FOUND') return res.status(404).json({ message: 'Assessment not found' });
            if (result.reason === 'ALREADY_PUBLISHED') {
                return res.status(409).json({ message: 'Cannot edit: this assessment has already been published for this semester' });
            }
            if (result.reason === 'LOCKED_FIELDS') {
                return res.status(409).json({ message: 'This assessment has been published before: only weight and rubrics can be changed' });
            }
            if (result.reason === 'DUPLICATE_ASSESSMENT_TYPE') {
                return res.status(409).json({ message: 'Assessment type already exists for this band' });
            }
            if (result.reason === 'SEMESTER_BAND_NOT_FOUND') {
                return res.status(404).json({ message: 'No matching band found for this semester' });
            }
            return res.status(500).json({ message: 'Failed to update assessment' });
        }
        return res.status(200).json({ message: 'Assessment updated successfully' });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to update assessment' });
    }
}

async function removeAssessment(req, res) {
    try {
        const { assessmentId } = req.params;
        const result = await deleteAssessment(assessmentId);

        if (!result.success) {
            if (result.reason === 'NOT_FOUND') return res.status(404).json({ message: 'Assessment not found' });
            if (result.reason === 'ALREADY_PUBLISHED') {
                return res.status(409).json({ message: 'Cannot delete: this assessment has published records' });
            }
        }
        return res.status(200).json({ message: 'Assessment deleted successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to delete assessment' });
    }
}

// POST /assessments/:assessmentId/unpublish
async function unpublish(req, res) {
    try {
        const { assessmentId } = req.params;
        const { semesterId } = req.body;
        if (!semesterId) return res.status(400).json({ message: 'semesterId is required' });

        const result = await unpublishAssessment(assessmentId, Number(semesterId));

        if (!result.success) {
            if (result.reason === 'NOT_PUBLISHED') return res.status(400).json({ message: 'This assessment is not published for this semester' });
            if (result.reason === 'HAS_SUBMISSIONS') {
                return res.status(409).json({ message: 'Cannot unpublish: students have already submitted work' });
            }
        }
        return res.status(200).json({ message: 'Assessment unpublished successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to unpublish assessment' });
    }
}

// GET /assessments/:assessmentId
async function getAssessment(req, res) {
    try {
        const assessment = await getAssessmentById(req.params.assessmentId);
        if (!assessment) return res.status(404).json({ message: 'Assessment not found' });
        return res.status(200).json({ data: assessment });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to fetch assessment' });
    }
}

// GET /assessments  (general template list/filter)
async function getAssessments(req, res) {
    try {
        const { semesterId } = req.params;

        if (!semesterId) {
            return res.status(400).json({ message: 'semesterId is required' });
        }
        if (req.query.band && !validBands.includes(req.query.band.toUpperCase())) {
            return res.status(400).json({ message: `band must be one of: ${validBands.join(', ')}` });
        }

        const assessmentType = req.query.assessmentType || null;
        const component = req.query.component || null;
        const band = req.query.band ? req.query.band.toUpperCase() : null;

        const assessments = await getAllAssessmentsFiltered(Number(semesterId), assessmentType, component, band);
        return res.status(200).json({ data: assessments });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to fetch assessments' });
    }
}

// POST /assessments/:assessmentId/publish
async function publish(req, res) {
    try {
        const { assessmentId } = req.params;
        const { semesterId, dueDate } = req.body;

        if (!semesterId || !dueDate) {
            return res.status(400).json({ message: 'semesterId and dueDate are required' });
        }

        const result = await publishAssessment(assessmentId, Number(semesterId), dueDate);

        if (!result.success) {
            if (result.reason === 'NOT_FOUND') return res.status(404).json({ message: 'Assessment not found' });
            if (result.reason === 'ALREADY_PUBLISHED') return res.status(409).json({ message: 'Already published for this semester' });
            if (result.reason === 'NO_STUDENTS') return res.status(400).json({ message: 'No students found for this band in this semester' });
        }

        return res.status(200).json({ message: 'Assessment published successfully', studentsAssigned: result.studentsAssigned });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to publish assessment' });
    }
}

async function renderBandAssessmentsPage(req, res) {
    const { semesterId, band } = req.params;
    res.render('assessmentsList', { semesterId, band });
}

module.exports = { addAssessment, editAssessment, removeAssessment, getAssessment, getAssessments, publish, renderBandAssessmentsPage, unpublish, validateAssessmentBody };