const pool = require('./db');

async function getAssessmentsByStudent(studentId) {
    const [rows] = await pool.query(
        `SELECT sa.studentAssessmentId, sa.status, a.assessmentName, a.assessmentType, a.totalMarks, a.passingMarks, s.subjectName
         FROM studentAssessment sa
         JOIN assessment a ON sa.assessmentId = a.assessmentId
         JOIN subject s ON a.subjectId = s.subjectId
         WHERE sa.studentId = ?`, [studentId]
    );
    return rows;
}

async function createAssessmentTemplate(data) {
    const [result] = await pool.query(
        `INSERT INTO assessment 
        (assessmentName, subjectId, semesterId, band, level, assessmentDate, assessmentType, totalMarks, passingMarks) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.assessmentName, data.subjectId, data.semesterId, data.band, data.level, data.assessmentDate, data.assessmentType, data.totalMarks, data.passingMarks]
    );
    return result.insertId;
}

async function assignAssessmentToStudent(studentId, assessmentId) {
    const [result] = await pool.query(
        `INSERT INTO studentAssessment (studentId, assessmentId, status) VALUES (?, ?, 'Assigned')`,
        [studentId, assessmentId]
    );
    return result.insertId;
}

async function submitAssessment(data) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query(
            `UPDATE studentAssessment SET status = 'Submitted' WHERE studentAssessmentId = ?`, 
            [data.studentAssessmentId]
        );

        const [result] = await connection.query(
            `INSERT INTO assessmentSubmission 
            (studentAssessmentId, submittedDate, submittedBy, filepath, score, analysis, isAccepted) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [data.studentAssessmentId, data.submittedDate, data.submittedBy, data.filepath, data.score, data.analysis, data.isAccepted || 0]
        );

        await connection.commit();
        return result.insertId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    getAssessmentsByStudent,
    createAssessmentTemplate,
    assignAssessmentToStudent,
    submitAssessment
};