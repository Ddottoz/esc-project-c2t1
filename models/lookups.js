const pool = require('./db');

async function getAllCentres() {
    const [rows] = await pool.query(
        'SELECT centreId, centreName FROM centre ORDER BY centreName'
    );
    return rows;
}

async function getAllSchools() {
    const [rows] = await pool.query(
        'SELECT schoolId, schoolName FROM school ORDER BY schoolName'
    );
    return rows;
}

// filter by centreId if provided; otherwise return all educators
async function getAllEducators(centreId) {
    const sql = centreId
    ? 'SELECT educatorId, educatorName, centreId FROM educator WHERE centreId = ? ORDER BY educatorName'
    : 'SELECT educatorId, educatorName, centreId FROM educator ORDER BY educatorName';
    const params = centreId ? [centreId] : [];
    const [rows] = await pool.query(sql, params);
    return rows;
}

async function getAllSemesters() {
    const [rows] = await pool.query(
        `SELECT semesterId, academicYear, semesterNo FROM semester ORDER BY academicYear, semesterNo`
    );
    return rows;
}

async function getAllBands() {
    const [rows] = await pool.query(
        `SELECT band FROM band ORDER BY band`
    );
    return rows;
}

module.exports = {getAllCentres, getAllSchools, getAllEducators, getAllSemesters, getAllBands};