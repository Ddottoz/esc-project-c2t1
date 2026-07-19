const pool = require('./db');

// not finalised

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

async function setProgrammesForStudent(studentId, programmeNames) {
    await pool.query(`DELETE FROM StudentProgramme WHERE student_id = ?`, [studentId]);
    if (programmeNames.length === 0) return;

    const [rows] = await pool.query(
        `SELECT programme_id, programme_name FROM Programme WHERE programme_name IN (?)`, [programmeNames]
    );
    for (const row of rows) {
        await pool.query(`INSERT INTO StudentProgramme (student_id, programme_id) VALUES (?, ?)`, [studentId, row.programme_id]);
    }
}

// Contact Persons 1-to-many rs
async function getContactsForStudent(studentId) {
    const [rows] = await pool.query(
        `SELECT contact_id AS contactId, contact_name AS contactName, phone_number AS phoneNumber, email, relationship, is_primary AS isPrimary FROM ContactPerson WHERE student_id = ?`, [studentId]
    );
    return rows.map((r) => ({...r, isPrimary: Boolean(r.isPrimary)}));
}

// replaces a student's contact persons with the given list
// delete-then-reinsert
async function setContactsForStudent(studentId, contacts) {
    await pool.query(`DELETE FROM ContactPerson WHERE student_id = ?`, [studentId]);
    for (const c of contacts) {
        await pool.query(
            `INSERT INTO ContactPerson (student_id, contact_name, phone_number, email, relationship, is_primary) VALUES (?, ?, ?, ?, ?, ?)`, 
            [studentId, c.contactName, c.phoneNumber, c.email, c.relationship, c.isPrimary ? 1 : 0]);
    }
}

module.exports = {
    getAllStudents,
    getStudentById,
    studentExists,
    addStudent,
    updateStudent,
    searchStudents
};