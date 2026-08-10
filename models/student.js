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

    const [studentRows] = await pool.query(
        `SELECT 
            s.*,
            c.centreName
         FROM student s
         LEFT JOIN centre c ON s.centreId = c.centreId
         WHERE s.studentId = ?`, 
        [studentId]
    );
    const student = studentRows[0];

    if (!student) {
        throw new Error(`Student with ID ${studentId} not found`);
    }

    const [semRows] = await pool.query(
        `SELECT DISTINCT semesterId 
         FROM studentAssessment 
         WHERE studentId = ? AND semesterId IS NOT NULL
         ORDER BY semesterId ASC`,
        [studentId]
    );
    const availableSemesters = semRows.map(r => r.semesterId);
    const activeStartSem = startSem || availableSemesters[0] || '202501';
    const activeEndSem = endSem || availableSemesters[availableSemesters.length - 1] || '202602';

    const [historicalBands] = await pool.query(
        `SELECT 
            sa.semesterId,
            a.band AS derivedBand,
            COUNT(*) as frequency
         FROM studentAssessment sa
         JOIN assessment a ON sa.assessmentId = a.assessmentId
         WHERE sa.studentId = ?
         GROUP BY sa.semesterId, a.band
         ORDER BY sa.semesterId DESC, frequency DESC`,
        [studentId]
    );

    const semBandMap = {};
    for (const row of historicalBands) {
        if (!semBandMap[row.semesterId]) {
            semBandMap[row.semesterId] = row.derivedBand;
        }
    }

    const [assessments] = await pool.query(
        `SELECT 
            sa.studentAssessmentId,
            sa.semesterId,
            sa.score,
            sa.status,
            sa.dueDate,
            a.assessmentType,
            a.component,
            ssb.band AS currentSemBand,
            a.band AS testTargetBand,
            a.passingMark,
            a.totalMark
         FROM studentAssessment sa
         JOIN assessment a ON sa.assessmentId = a.assessmentId
         LEFT JOIN studentSemBand ssb 
             ON sa.studentId = ssb.studentId 
            AND sa.semesterId = ssb.semesterId
         WHERE sa.studentId = ? 
           AND sa.semesterId BETWEEN ? AND ?
         ORDER BY sa.semesterId DESC`,
        [studentId, activeStartSem, activeEndSem]
    );

    const processedAssessments = assessments.map(row => ({
        ...row,
        assessmentBand: row.currentSemBand || semBandMap[row.semesterId] || row.testTargetBand
    }));

    return {
        student,
        assessments: processedAssessments,
        availableSemesters,
        activeStartSem,
        activeEndSem
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