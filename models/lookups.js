const pool = require('./db');

async function getAllCentres() {
    const [rows] = await pool.query(
        'SELECT centre_id AS centreId, centre_name AS centreName FROM Centre ORDER BY centre_name'
    );
    return rows;
}

async function getAllSchools() {
    const [rows] = await pool.query(
        'SELECT school_id AS schoolId, school_name AS schoolName FROM School ORDER BY school_name'
    );
    return rows;
}

async function getAllTeachers(centreId) {
    const sql = centreId
    ? 'SELECT teacher_id AS teacherId, teacher_name AS teacherName, centre_id AS centreId FROM Teacher WHERE centre_id = ? ORDER BY teacher_name'
    : 'SELECT teacher_id AS teacherId, teacher_name AS teacherName, centre_id AS centreId FROM Teacher ORDER BY teacher_name';
    const params = centreId ? [centreId] : [];
    const [rows] = await pool.query(sql, params);
    return rows;
}

async function getAllProgrammes() {
    const [rows] = await pool.query(
        'SELECT programme_id AS programmeId, programme_name AS programmeName FROM Programme ORDER BY programme_name'
    );
    return rows;
}

module.exports = {getAllCentres, getAllSchools, getAllTeachers, getAllProgrammes};