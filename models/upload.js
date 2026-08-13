const pool = require("./db");

async function createAssessmentSubmission(
    studentAssessmentId,
    submittedDate,
    filePath
) {
    const sql = `
        INSERT INTO assessmentSubmission
        (studentAssessmentId, submittedDate, submittedBy, filepath, isAccepted)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            submittedDate = VALUES(submittedDate),
            submittedBy = VALUES(submittedBy),
            filepath = VALUES(filepath),
            isAccepted = VALUES(isAccepted)
    `;

    const [result] = await pool.query(sql, [
        studentAssessmentId,
        submittedDate,
        1,
        filePath,
        0
    ]);

    return result;
}
async function createDiagnosticSummary(
    studentAssessmentId,
    diagnosticSummary
) {
    const sql = `
        INSERT INTO assessment_analysis
        (submissionId, diagnosticSummary, isAccepted)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
            diagnosticSummary = VALUES(diagnosticSummary),
            isAccepted = VALUES(isAccepted)
    `;

    const [result] = await pool.query(sql, [
        studentAssessmentId,
        diagnosticSummary,
        0
    ]);

    return result;
}

async function getAllUploads(studentAssessmentId) {

    const [rows] = await pool.query(
        `SELECT 
            submissionId as id,
            submittedDate as date,
            filepath
         FROM assessmentSubmission
         WHERE studentAssessmentId = ?
         ORDER BY submittedDate DESC`,
         [studentAssessmentId]
    );

    return rows;
}

async function setAssessmentAssigned(studentAssessmentId) {
    const sql = `
        UPDATE studentAssessment
        SET status = 'Assigned'
        WHERE studentAssessmentId = ?
    `;

    const [result] = await pool.query(sql, [
        studentAssessmentId
    ]);

    return result;
}
async function getAssessmentInfoFromId(studentAssessmentId){
    const sql = `
        select ss.studentId as studentId, ss.studentAssessmentId,
            semester.academicYear as academicYear, semester.semesterNo as semNo, semester.semesterId as semId,
            assessment.assessmentType as assessmentType, assessment.band as band
            from studentAssessment as ss
            left join semester on semester.semesterId=ss.semesterId
            left join assessment on assessment.assessmentId=ss.assessmentId
            where studentAssessmentId = ?;
    `;

    const [result] = await pool.query(sql, [
        studentAssessmentId
    ]);

    return result[0];
}

module.exports = {
    createAssessmentSubmission,
    createDiagnosticSummary,
    getAllUploads,
    setAssessmentAssigned,
    getAssessmentInfoFromId
};