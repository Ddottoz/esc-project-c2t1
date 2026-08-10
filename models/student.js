const pool = require('./db');

async function getAllStudents() {
    const [rows] = await pool.query(
        'SELECT student_id AS studentId, student_name AS studentName, phone_number AS phoneNumber, email, date_of_birth as dateOfBirth, sch_level AS schLevel, school_id AS schoolId, centre_id AS centreId, teacher_id AS teacherId FROM Student'
    );
    for (const s of rows) {
        s.programmesAttending = await getProgrammesForStudent(s.studentId);
        s.contactPersons = await getContactsForStudent(s.studentId);
    }
    return rows;
}

async function getStudentById(id) {
    const [rows] = await pool.query(
        `SELECT student_id AS studentId, student_name AS studentName, phone_number AS phoneNumber, email, date_of_birth AS dateOfBirth, sch_level AS schLevel, school_id AS schoolId, centre_id AS centreId, teacher_id AS teacherId FROM Student WHERE student_id = ?`, [id]
    );
    if (rows.length === 0) return null;
    const student = rows[0];
    student.programmesAttending = await getProgrammesForStudent(id);
    student.contactPersons = await getContactsForStudent(id);
    return student;
}

// UC4 "studentId alr exists" check
async function studentExists(id) {
    const [rows] = await pool.query(`SELECT student_id FROM Student WHERE student_id = ?`, [id]);
    return rows.length > 0;
}

async function addStudent(data) {
    const [result] = await pool.query(
        `INSERT INTO Student
        (student_id, student_name, phone_number, email, date_of_birth, sch_level, school_id, centre_id, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.studentId, data.studentName, data.phoneNumber, data.email, data.dateOfBirth, data.schLevel, data.schoolId, data.centreId, data.teacherId]
    );
    await setProgrammesForStudent(data.studentId, data.programmesAttending || []);
    await setContactsForStudent(data.studentId, data.contactPersons || []);
    return data.studentId;
}

async function updateStudent(id, data) {
    const [result] = await pool.query(
        `UPDATE Student SET student_name = ?, phone_number = ?, email = ?, date_of_birth = ?, sch_level = ?, school_id = ?, centre_id = ?, teacher_id = ? WHERE student_id = ?`,
        [data.studentName, data.phoneNumber, data.email, data.dateOfBirth, data.schLevel, data.schoolId, data.centreId, data.teacherId, id]
    );
    if (result.affectedRows === 0) return false;
    await setProgrammesForStudent(id, data.programmesAttending || []);
    await setContactsForStudent(id, data.contactPersons || []);
    return true;
}

// helpers for Student <-> Programme many-to-many rs
async function getProgrammesForStudent(studentId) {
    const [rows] = await pool.query(
        `SELECT p.programme_name FROM StudentProgramme sp JOIN Programme p ON sp.programme_id = p.programme_id WHERE sp.student_id = ?`, [studentId]
    );
    return rows.map((r) => r.programme_name);
}

// replaces a student's programmes with the given list
// delete-then-reinsert
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

module.exports = {getAllStudents, getStudentById, studentExists, addStudent, updateStudent};