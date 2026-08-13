const request = require('supertest');
const express = require('express');
const pool = require('../../models/db');
const assessmentRouter =
    require('../../routes/assessment');

const app = express();
app.use(express.json());
app.use('/assessments', assessmentRouter);

const TEST_MARKER =
    'ASSESSMENT_TESTINT_MARKER_DO_NOT_EDIT';

const VALID_ASSESSMENT_TYPES = [
    'Letter Formation',
    'Narrative Writing',
    'Exposition Writing',
    'Edit and Diagram 1',
    'Edit and Diagram 2',
    'Edit and Diagram 3',
    'Comprehension',
    'Primary',
    'Secondary',
    'Picture Naming',
    'Picture Description',
    'PA Identification',
    'Phonics',
    'Word Reading Accuracy',
    'Fluency',
    'Word Spelling'
];

async function cleanupAssessment(assessmentId) {
    await pool.query(
        `DELETE FROM studentAssessment
         WHERE assessmentId = ?`,
        [assessmentId]
    );

    await pool.query(
        `DELETE FROM semesterBandAssessmentWeight
         WHERE assessmentId = ?`,
        [assessmentId]
    );

    await pool.query(
        `DELETE FROM assessment
         WHERE assessmentId = ?`,
        [assessmentId]
    );
}

async function sweepMarkedAssessments() {
    const [rows] = await pool.query(
        `SELECT assessmentId
         FROM assessment
         WHERE rubrics LIKE ?`,
        [`${TEST_MARKER}%`]
    );

    for (const row of rows) {
        await cleanupAssessment(row.assessmentId);
    }
}

async function getSemesterBandWithStudents() {
    const [[row]] = await pool.query(
        `SELECT
            sb.semesterBandId,
            sb.semesterId,
            sb.band,
            COUNT(s.studentId) AS studentCount
         FROM semesterBand sb
         INNER JOIN student s
             ON s.currentSemester = sb.semesterId
            AND s.currentBand = sb.band
         GROUP BY
            sb.semesterBandId,
            sb.semesterId,
            sb.band
         HAVING COUNT(s.studentId) > 0
         ORDER BY sb.semesterId
         LIMIT 1`
    );

    if (!row) {
        throw new Error(
            'No semester-band with students exists'
        );
    }

    return row;
}

async function getAnySemesterBand() {
    const [[row]] = await pool.query(
        `SELECT semesterBandId, semesterId, band
         FROM semesterBand
         ORDER BY semesterId
         LIMIT 1`
    );

    if (!row) {
        throw new Error(
            'No semesterBand records exist'
        );
    }

    return row;
}

async function findUnusedAssessmentType(band) {
    const [rows] = await pool.query(
        `SELECT assessmentType
         FROM assessment
         WHERE band = ?`,
        [band]
    );

    const existingTypes = new Set(
        rows.map(row => row.assessmentType)
    );

    const unusedType =
        VALID_ASSESSMENT_TYPES.find(
            type => !existingTypes.has(type)
        );

    if (!unusedType) {
        throw new Error(
            `No unused assessment type for band ${band}`
        );
    }

    return unusedType;
}

async function insertTestAssessment({
    band,
    semesterBandId,
    assessmentType,
    component = 'Vocabulary',
    passingMark = 50,
    totalMark = 100,
    rubrics = TEST_MARKER,
    weight = 0
}) {
    const type =
        assessmentType ||
        await findUnusedAssessmentType(band);

    const [result] = await pool.query(
        `INSERT INTO assessment
            (
                assessmentType,
                component,
                band,
                passingMark,
                totalMark,
                rubrics
            )
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            type,
            component,
            band,
            passingMark,
            totalMark,
            rubrics
        ]
    );

    await pool.query(
        `INSERT INTO semesterBandAssessmentWeight
            (
                semesterBandId,
                assessmentId,
                weight
            )
         VALUES (?, ?, ?)`,
        [
            semesterBandId,
            result.insertId,
            weight
        ]
    );

    return {
        assessmentId: result.insertId,
        assessmentType: type,
        component,
        band,
        passingMark,
        totalMark,
        rubrics,
        weight
    };
}

async function getStudentsForSemesterBand({
    semesterId,
    band
}) {
    const [rows] = await pool.query(
        `SELECT studentId
         FROM student
         WHERE currentSemester = ?
           AND currentBand = ?`,
        [semesterId, band]
    );

    return rows;
}

module.exports = {
    app,
    request,
    pool,
    TEST_MARKER,
    cleanupAssessment,
    sweepMarkedAssessments,
    getSemesterBandWithStudents,
    getAnySemesterBand,
    findUnusedAssessmentType,
    insertTestAssessment,
    getStudentsForSemesterBand
};