const pool = require('./db');

async function getAllStudents() {
    const [rows] = await pool.query(
        `SELECT studentId, studentName, enrollmentDate, currentSemester, age, centreId, schoolId, schoolLevel 
         FROM student`
    );
    return rows;
}

async function getStudentById(id) {
    const [rows] = await pool.query(
        `SELECT studentId, studentName, enrollmentDate, currentSemester, age, centreId, schoolId, schoolLevel 
         FROM student WHERE studentId = ?`, [id]
    );
    if (rows.length === 0) return null;
    return rows[0];
}

async function studentExists(id) {
    const [rows] = await pool.query(`SELECT studentId FROM student WHERE studentId = ?`, [id]);
    return rows.length > 0;
}

async function addStudent(data) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        await connection.query(
            `INSERT INTO student 
            (studentId, studentName, enrollmentDate, currentSemester, age, centreId, schoolId, schoolLevel) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.studentId, data.studentName, data.enrollmentDate, data.currentSemester, data.age, data.centreId, data.schoolId, data.schoolLevel]
        );
        
        await connection.commit();
        return data.studentId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function updateStudent(id, data) {
    const [result] = await pool.query(
        `UPDATE student SET studentName = ?, enrollmentDate = ?, currentSemester = ?, age = ?, centreId = ?, schoolId = ?, schoolLevel = ? 
         WHERE studentId = ?`,
        [data.studentName, data.enrollmentDate, data.currentSemester, data.age, data.centreId, data.schoolId, data.schoolLevel, id]
    );
    return result.affectedRows > 0;
}

async function searchStudents(searchTerm) {
    const queryTerm = `%${searchTerm}%`;
    const [rows] = await pool.query(
        `SELECT studentId, studentName, schoolLevel FROM student 
         WHERE studentName LIKE ? OR schoolLevel LIKE ?`, 
        [queryTerm, queryTerm]
    );
    return rows;
}

module.exports = {
    getAllStudents,
    getStudentById,
    studentExists,
    addStudent,
    updateStudent,
    searchStudents
};