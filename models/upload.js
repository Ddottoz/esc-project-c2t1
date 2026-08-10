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
// async function uploadPdf(submissionId, originalName, storedName, filePath, comment) {

//     const sql = `
//         INSERT INTO pdf_files
//         (original_name, stored_name, file_path, comment)
//         VALUES (?, ?, ?, ?)
//     `;

//     const [result] = await pool.query(sql, [
//         originalName,
//         storedName,
//         filePath,
//         comment
//     ]);

//     return result;
// }

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

// async function updateAnalysis(id, analysis) {

//     const sql = `
//         UPDATE pdf_files
//         SET analysis = ?
//         WHERE id = ?
//     `;

//     const [result] = await pool.query(sql, [
//         JSON.stringify(analysis),
//         id
//     ]);

//     return result;
// }

module.exports = {
    createAssessmentSubmission,
    //uploadPdf,
    //updateAnalysis,
    getAllUploads
};