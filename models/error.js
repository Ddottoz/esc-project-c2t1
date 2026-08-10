const pool = require("./db");

async function insertError(
    submissionId,
    errorDescription,
    errorCategory
) {

    const sql = `
        INSERT INTO assessment_analysis_error
        (submissionId, detectedError, errorCategory)
        VALUES (?, ?, ?)
    `;

    const [result] = await pool.query(sql, [
        submissionId,
        errorDescription,
        errorCategory
    ]);

    return result;
}

module.exports = {
    insertError
};