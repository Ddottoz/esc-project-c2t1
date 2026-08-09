const pool = require("./db");

async function uploadPdf(originalName, storedName, filePath, comment) {

    const sql = `
        INSERT INTO pdf_files
        (original_name, stored_name, file_path, comment)
        VALUES (?, ?, ?, ?)
    `;

    const [result] = await pool.query(sql, [
        originalName,
        storedName,
        filePath,
        comment
    ]);

    return result;
}

async function getAllUploads() {

    const [rows] = await pool.query(
        `SELECT 
            id,
            original_name AS fileName,
            file_path AS filePath,
            comment,
            analysis
         FROM pdf_files
         ORDER BY id DESC`
    );

    return rows;
}

async function updateAnalysis(id, analysis) {

    const sql = `
        UPDATE pdf_files
        SET analysis = ?
        WHERE id = ?
    `;

    const [result] = await pool.query(sql, [
        JSON.stringify(analysis),
        id
    ]);

    return result;
}

module.exports = {
    uploadPdf,
    updateAnalysis,
    getAllUploads
};