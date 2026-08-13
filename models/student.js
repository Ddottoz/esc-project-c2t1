const pool = require('./db');

// Fetches all students with joined centre, school, educator & contact details
async function getAllStudents() {
    console.log('[DEBUG] STARTING getAllStudents');
    const [rows] = await pool.query(
        'SELECT s.studentId, s.firstName, s.lastName, s.nric, s.dateOfBirth, s.enrolmentDate, s.currentSemester, s.schoolLevel, s.centreId, s.schoolId, s.educatorId, s.currentBand, s.remarks, s.graduated, c.centreName, sc.schoolName, e.educatorName, sb.semesterBandId FROM student s LEFT JOIN centre c ON s.centreId = c.centreId LEFT JOIN school sc ON s.schoolId = sc.schoolId LEFT JOIN educator e ON s.educatorId = e.educatorId LEFT JOIN semesterBand sb ON sb.semesterId = s.currentSemester AND sb.band = s.currentBand'
    );
    if (rows.length === 0) return rows;
    // batch fetch contacts to avoid the N+1 query problem (1 round-trip vs N round-trips)
    // once there are many students (each round-trip to a remote DB adds up fast)
    const studentIds = rows.map((s) => s.studentId);
    const [allContacts] = await pool.query(
        `SELECT studentId, contactId, contactName, phoneNumber, email, relationship, isPrimary FROM contactPerson WHERE studentId IN (?)`, [studentIds]
    );

    // group flat contact lists by studentId
    const contactsByStudent = {};
    for (const c of allContacts) {
        if (!contactsByStudent[c.studentId]) contactsByStudent[c.studentId] = [];
        contactsByStudent[c.studentId].push({...c, isPrimary: Boolean(c.isPrimary)});
    }

    for (const s of rows) {
        s.contactPersons = contactsByStudent[s.studentId] || [];
    }
    return rows;
}

async function getStudentById(studentId) {
    const [rows] = await pool.query(
        `SELECT s.studentId, s.firstName, s.lastName, s.nric, s.dateOfBirth, s.enrolmentDate, s.currentSemester, s.schoolLevel, s.centreId, s.schoolId, s.educatorId, s.currentBand, s.remarks, s.graduated, c.centreName, sc.schoolName, e.educatorName FROM student s LEFT JOIN centre c ON s.centreId = c.centreId LEFT JOIN school sc ON s.schoolId = sc.schoolId LEFT JOIN educator e ON s.educatorId = e.educatorId WHERE s.studentId = ?`, [studentId]
    );
    if (rows.length === 0) return null;
    const student = rows[0];
    student.contactPersons = await getContactsForStudent(studentId);
    return student;
}

async function getStudentsByEducator(educatorId) {
    const [rows] = await pool.query(
        `SELECT studentId, firstName, lastName, schoolLevel, currentSemester, currentBand FROM student WHERE educatorId = ? ORDER BY lastName, firstName`, [educatorId]
    );
    return rows;
}

// UC4 "nric alr exists" check
async function nricExists(nric) {
    const [rows] = await pool.query(`SELECT studentId FROM student WHERE nric = ?`, [nric]);
    return rows.length > 0;
}

// calculates age as of today - only used to keep the `age` column
function calculateAgeServerSide(dateOfBirthStr) {
    const dob = new Date(dateOfBirthStr);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const hasHadBirthday = today.getMonth() > dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
    if (!hasHadBirthday) age -= 1;
    return age;
}

// creates student record (enrollment date auto-set to today), assign them to their starting BandGroup
async function addStudent(data) {
    const age = calculateAgeServerSide(data.dateOfBirth);
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [result] = await connection.query(
        `INSERT INTO student
        (firstName, lastName, nric, enrolmentDate, currentSemester, age, dateOfBirth, schoolLevel, centreId, schoolId, educatorId, currentBand, remarks) VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.firstName, data.lastName, data.nric, data.semesterId, age, data.dateOfBirth, data.schLevel, data.centreId, data.schoolId, data.educatorId, data.currentBand, data.remarks || null]
        );
        const newStudentId = result.insertId;   // id is set to auto-increment
        
        // pass connection into helpers
        await recordSemBand(connection, newStudentId, data.semesterId, data.currentBand);
        await setContactsForStudent(connection, newStudentId, data.contactPersons || []);

        await connection.commit();  // saves everyth permanently
        return newStudentId;
    } catch(err) {
        await connection.rollback();    // undoes all steps if any single step fails
        throw err;  // re-throw so API/route layer knows it failed
    } finally {
        connection.release();   // always release connection back to pool
    }
}

// firstName, lastName, nric & dateOfBirth are intentionally left out of this update
// update student, semBand record & contacts as 1 atomic unit
async function updateStudent(studentId, data) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [result] = await connection.query(
        `UPDATE student SET currentSemester = ?, schoolLevel = ?, centreId = ?, schoolId = ?, educatorId = ?, currentBand = ?, remarks = ? WHERE studentId = ?`,
        [data.semesterId, data.schLevel, data.centreId, data.schoolId, data.educatorId, data.currentBand, data.remarks || null, studentId]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return false;
        }

        // pass connection into helpers
        await recordSemBand(connection, studentId, data.semesterId, data.currentBand);
        await setContactsForStudent(connection, studentId, data.contactPersons || []);

        await connection.commit();
        return true;
    } catch(err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function deleteStudent(studentId) {
    const [result] = await pool.query(`DELETE FROM student WHERE studentId = ?`, [studentId]);
    return result.affectedRows > 0;
}

// accept the transaction connection
async function recordSemBand(connection, studentId, semesterId, band) {
    await connection.query(
        `INSERT INTO studentSemBand (semesterId, studentId, band) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE band = VALUES(band)`, [semesterId, studentId, band]
    );
}

// Contact Persons 1-to-many rs
async function getContactsForStudent(studentId) {
    console.log('[DEBUG] fetching contacts for', studentId);
    const [rows] = await pool.query(
        `SELECT contactId, contactName, phoneNumber, email, relationship, isPrimary FROM contactPerson WHERE studentId = ?`, [studentId]
    );
    return rows.map((r) => ({...r, isPrimary: Boolean(r.isPrimary)}));
}

// replaces a student's contact persons with the given list
// delete-then-reinsert
// accept the transaction connection
async function setContactsForStudent(connection, studentId, contacts) {
    await connection.query(`DELETE FROM contactPerson WHERE studentId = ?`, [studentId]);
    for (const c of contacts) {
        await connection.query(
            `INSERT INTO contactPerson (studentId, contactName, phoneNumber, email, relationship, isPrimary) VALUES (?, ?, ?, ?, ?, ?)`, 
            [studentId, c.contactName, c.phoneNumber, c.email, c.relationship, c.isPrimary ? 1 : 0]);
    }
}

// per-component assessment rows for the progress view
// 1 row/studentAssessment attempt
async function getAssessmentSubmissionsForStudent(studentId) {
    const [rows] = await pool.query(
        `SELECT sa.semesterId, a.component AS componentName, asub.analysis AS remarks FROM studentAssessment sa JOIN assessment a ON a.assessmentId = sa.assessmentId LEFT JOIN assessmentSubmission asub ON asub.studentAssessmentId = sa.studentAssessmentId WHERE sa.studentId = ? ORDER BY sa.semesterId DESC`, [studentId]
    );
    return rows;
}

// overall band per sem, joined to sem label for display
async function getSemBandsForStudent(studentId) {
    const [rows] = await pool.query(
        `SELECT sb.semesterId, sb.band, sem.academicYear, sem.semesterNo FROM studentSemBand sb LEFT JOIN semester sem ON sem.semesterId = sb.semesterId WHERE sb.studentId = ? ORDER BY sb.semesterId DESC`, [studentId]
    );
    return rows.map((r) => ({
        semesterId: r.semesterId,
        band: r.band, 
        semesterLabel: `AY${r.academicYear} Sem ${r.semesterNo}`
    }));
}

// assembles full progress report for a student grouped by sem, most -> least recent
async function getProgressData(studentId) {
    const student = await getStudentById(studentId);
    if (!student) return null;

    const submissions = await getAssessmentSubmissionsForStudent(studentId);
    const semBands = await getSemBandsForStudent(studentId);

    // String() guards against studentAssessment.semesterId & studentSemBand.semesterId being different underlying MySQL types
    const semesters = semBands.map((sem) => ({
        semesterId: sem.semesterId,
        semesterLabel: sem.semesterLabel,
        band: sem.band,
        components: submissions.filter((s) => String(s.semesterId) === String(sem.semesterId)).map((s) => ({
            componentName: s.componentName,
            band: sem.band,
            remarks: s.remarks
        }))
    }));

    return {
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        currentBand: student.currentBand,
        semesters
    };
}

//UC7
async function generateReport(studentId, startSem, endSem) {

    const [studentRows] = await pool.query(
        `SELECT 
            s.*,
            c.centreName,
            sb.semesterBandId
         FROM student s
         LEFT JOIN centre c ON s.centreId = c.centreId
         LEFT JOIN semesterBand sb
             ON sb.semesterId = s.currentSemester
            AND sb.band = s.currentBand
         WHERE s.studentId = ?`, 
        [studentId]
    );
    const student = studentRows[0];

    if (!student) {
        return null;
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

module.exports = {getAllStudents, getStudentById, getStudentsByEducator, nricExists, addStudent, updateStudent, deleteStudent, getAssessmentSubmissionsForStudent, getSemBandsForStudent, getProgressData, generateReport};
