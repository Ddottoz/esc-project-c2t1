const pool = require('./db');

// not finalised

async function getAllStudents() {
    const [rows] = await pool.query(
        `SELECT studentId, firstName, enrolmentDate, currentSemester, age, centreId, schoolId, schoolLevel 
         FROM student`
    );
    return rows;
}

async function getStudentById(id) {
    const [rows] = await pool.query(
        `SELECT 
            s.*, 
            c.centreName 
         FROM student s
         LEFT JOIN centre c ON s.centreId = c.centreId
         WHERE s.studentId = ?`, [id]
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
            (studentId, firstName, enrolmentDate, currentSemester, age, centreId, schoolId, schoolLevel) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.studentId, data.firstName, data.enrolmentDate, data.currentSemester, data.age, data.centreId, data.schoolId, data.schoolLevel]
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
        `UPDATE student SET firsttName = ?, enrolmentDate = ?, currentSemester = ?, age = ?, centreId = ?, schoolId = ?, schoolLevel = ? 
         WHERE studentId = ?`,
        [data.firstName, data.enrolmentDate, data.currentSemester, data.age, data.centreId, data.schoolId, data.schoolLevel, id]
    );
    return result.affectedRows > 0;
}

async function searchStudents(searchTerm) {
    const queryTerm = `%${searchTerm}%`;
    const [rows] = await pool.query(
        `SELECT studentId, firstName, schoolLevel FROM student 
         WHERE firstName LIKE ? OR schoolLevel LIKE ?`, 
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

//UC7
async function generateReport(studentId, startSem, endSem) {
    // 1. Fetch student info
    const student = await getStudentById(studentId);
    if (!student) throw new Error('Student Profile Not Found');

    // 2. Fetch available semesters for the filter dropdown
    const [semRows] = await pool.query(
        `SELECT DISTINCT semesterId 
         FROM studentAssessment 
         WHERE studentId = ? 
         ORDER BY semesterId DESC`,
        [studentId]
    );
    const availableSemesters = semRows.map(r => r.semesterId);

    // Default to available range if filters aren't explicitly passed
    const activeStartSem = startSem || availableSemesters[availableSemesters.length - 1] || '202501';
    const activeEndSem = endSem || availableSemesters[0] || '202602';

    // 3. Fetch actual assessment performance records directly from studentAssessment
    const [assessments] = await pool.query(
        `SELECT 
            sa.studentAssessmentId,
            sa.semesterId,
            sa.score,
            a.component,
            a.assessmentType,
            a.passingMark,
            a.band AS assessmentBand
         FROM studentAssessment sa
         JOIN assessment a ON sa.assessmentId = a.assessmentId
         WHERE sa.studentId = ? 
           AND sa.semesterId BETWEEN ? AND ?
         ORDER BY sa.semesterId DESC`,
        [studentId, activeStartSem, activeEndSem]
    );

    return {
        student,
        assessments,
        availableSemesters
    };
}

module.exports = {
    getAllStudents,
    getStudentById,
    studentExists,
    addStudent,
    updateStudent,
    searchStudents,
    generateReport
};