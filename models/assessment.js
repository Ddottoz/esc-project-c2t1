const pool = require('./db');

async function getStudentsByBandAndSemester(connection, band, semesterId) {
    const [students] = await connection.query(
        `SELECT studentId FROM student WHERE currentBand = ? AND currentSemester = ?`,
        [band, semesterId]
    );
    return students;
}

// helper - getsembandid from semesterId and band
async function getSemBandIdByBandAndSemester(connection, band, semesterId) {
    const [rows] = await connection.query(
        `SELECT semesterBandId FROM semesterBand WHERE semesterId = ? AND band = ?;`,
        [semesterId, band]
    );
    return rows[0]?.semesterBandId ?? null;
}

async function createSemBandAssessmentWgt(connection, semesterBandId, assessmentId, weight) {
    const [result] = await connection.query(
        `INSERT INTO semesterBandAssessmentWeight (semesterBandId, assessmentId, weight) VALUES (?, ?, ?);`,
        [semesterBandId, assessmentId, weight]
    );
    return result.affectedRows > 0;
}
async function getSemAndBandBySemBandId(semBandId) {
    const [rows] = await pool.query(
        `SELECT semesterId, band
         FROM semesterBand
         WHERE semesterBandId = ?`,
        [semBandId]
    );

    return rows[0] ?? null;
}

// --- Template CRUD ---

async function addAssessment(connection, { assessmentType, component, band, passingMark, totalMark, rubrics }) {
    const [result] = await connection.query(
        `INSERT INTO assessment (assessmentType, component, band, passingMark, totalMark, rubrics) VALUES (?, ?, ?, ?, ?, ?)`,
        [assessmentType, component, band, passingMark, totalMark, rubrics]
    );
    return result.insertId;
}

async function createAssessment({ assessmentType, component, band, passingMark, totalMark, rubrics }, semesterId, weight) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Check for duplicate assessmentType within the same band
        const [[{ dupCount }]] = await connection.query(
            `SELECT COUNT(*) AS dupCount FROM assessment WHERE band = ? AND assessmentType = ?`,
            [band, assessmentType]
        );
        if (dupCount > 0) {
            await connection.rollback();
            return { success: false, reason: 'DUPLICATE_ASSESSMENT_TYPE' };
        }

        // 1. Create the assessment template
        const assessmentId = await addAssessment(connection, {
            assessmentType, component, band, passingMark, totalMark, rubrics
        });

        // 2. Look up the semesterBandId for this band + semester
        const semesterBandId = await getSemBandIdByBandAndSemester(connection, band, semesterId);
        if (!semesterBandId) {
            await connection.rollback();
            return { success: false, reason: 'SEMESTER_BAND_NOT_FOUND' };
        }

        // 3. Create the weight record linking them
        const weightCreated = await createSemBandAssessmentWgt(connection, semesterBandId, assessmentId, weight);
        if (!weightCreated) {
            await connection.rollback();
            return { success: false, reason: 'WEIGHT_CREATION_FAILED' };
        }

        await connection.commit();
        return { success: true, assessmentId };

    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function updateAssessment(assessmentId, { assessmentType, component, band, passingMark, totalMark, rubrics }, semesterId, weight) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [[existing]] = await connection.query(`SELECT * FROM assessment WHERE assessmentId = ?`, [assessmentId]);
        if (!existing) {
            await connection.rollback();
            return { success: false, reason: 'NOT_FOUND' };
        }

        // published THIS semester → no edit at all (client hides the edit button too, this is the server-side backstop)
        const [[{ publishedThisSemester }]] = await connection.query(
            `SELECT COUNT(*) AS publishedThisSemester FROM studentAssessment WHERE assessmentId = ? AND semesterId = ?`,
            [assessmentId, semesterId]
        );
        if (publishedThisSemester > 0) {
            await connection.rollback();
            return { success: false, reason: 'ALREADY_PUBLISHED' };
        }

        // published in ANY semester (including past ones) → only weight + rubrics can move
        const [[{ publishedAnywhere }]] = await connection.query(
            `SELECT COUNT(*) AS publishedAnywhere FROM studentAssessment WHERE assessmentId = ?`,
            [assessmentId]
        );

        const semesterBandId = await getSemBandIdByBandAndSemester(connection, band, semesterId);
        if (!semesterBandId) {
            await connection.rollback();
            return { success: false, reason: 'SEMESTER_BAND_NOT_FOUND' };
        }

        if (publishedAnywhere > 0) {
            const coreChanged =
                existing.assessmentType !== assessmentType ||
                existing.component !== component ||
                existing.band !== band ||
                Number(existing.passingMark) !== Number(passingMark) ||
                Number(existing.totalMark) !== Number(totalMark);

            if (coreChanged) {
                await connection.rollback();
                return { success: false, reason: 'LOCKED_FIELDS' };
            }

            await connection.query(`UPDATE assessment SET rubrics = ? WHERE assessmentId = ?`, [rubrics, assessmentId]);
        } else {
            const [[{ dupCount }]] = await connection.query(
                `SELECT COUNT(*) AS dupCount FROM assessment WHERE band = ? AND assessmentType = ? AND assessmentId != ?`,
                [band, assessmentType, assessmentId]
            );
            if (dupCount > 0) {
                await connection.rollback();
                return { success: false, reason: 'DUPLICATE_ASSESSMENT_TYPE' };
            }

            await connection.query(
                `UPDATE assessment SET assessmentType = ?, component = ?, band = ?, passingMark = ?, totalMark = ?, rubrics = ? WHERE assessmentId = ?`,
                [assessmentType, component, band, passingMark, totalMark, rubrics, assessmentId]
            );
        }

        await connection.query(
            `INSERT INTO semesterBandAssessmentWeight (semesterBandId, assessmentId, weight) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE weight = VALUES(weight)`,
            [semesterBandId, assessmentId, weight]
        );

        await connection.commit();
        return { success: true };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function getAssessmentById(assessmentId) {
    const [rows] = await pool.query(`SELECT * FROM assessment WHERE assessmentId = ?`, [assessmentId]);
    return rows[0] || null;
}

async function getAllAssessmentsFiltered(semesterId, assessmentType = null, component = null, band = null) {
    let queryStr = `
        SELECT 
            a.assessmentId, a.assessmentType, a.component, a.band, a.passingMark, a.totalMark, a.rubrics, sbaw.weight,
            COUNT(sa.studentAssessmentId) AS totalAssigned,
            SUM(CASE WHEN sa.status IN ('submitted', 'graded') THEN 1 ELSE 0 END) AS totalSubmitted,
            SUM(CASE WHEN sa.status = 'graded' THEN 1 ELSE 0 END) AS totalGraded,
            CASE WHEN COUNT(sa.studentAssessmentId) > 0 THEN true ELSE false END AS isPublished,
            CASE WHEN (SELECT COUNT(*) FROM studentAssessment sa2 WHERE sa2.assessmentId = a.assessmentId) > 0 THEN true ELSE false END AS isPublishedAnywhere
        FROM assessment a
        LEFT JOIN semesterBand sb 
            ON sb.semesterId = ? AND sb.band = a.band
        LEFT JOIN semesterBandAssessmentWeight sbaw 
            ON sbaw.assessmentId = a.assessmentId AND sbaw.semesterBandId = sb.semesterBandId
        LEFT JOIN studentAssessment sa 
            ON sa.assessmentId = a.assessmentId AND sa.semesterId = ?
        WHERE 1=1
    `;
    let params = [semesterId, semesterId];

    if (assessmentType != null) {
        queryStr += ` AND a.assessmentType = ?`;
        params.push(assessmentType);
    }
    if (component != null) {
        queryStr += ` AND a.component LIKE ?`;
        params.push(`%${component}%`);
    }
    if (band != null) {
        queryStr += ` AND a.band = ?`;
        params.push(band);
    }

    queryStr += ` GROUP BY a.assessmentId ORDER BY a.assessmentId;`;

    const [rows] = await pool.query(queryStr, params);
    return rows;
}

async function deleteAssessment(assessmentId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [[existing]] = await connection.query(`SELECT assessmentId FROM assessment WHERE assessmentId = ?`, [assessmentId]);
        if (!existing) {
            await connection.rollback();
            return { success: false, reason: 'NOT_FOUND' };
        }

        const [[{ publishedCount }]] = await connection.query(
            `SELECT COUNT(*) AS publishedCount FROM studentAssessment WHERE assessmentId = ?`,
            [assessmentId]
        );
        if (publishedCount > 0) {
            await connection.rollback();
            return { success: false, reason: 'ALREADY_PUBLISHED' };
        }

        await connection.query(`DELETE FROM semesterBandAssessmentWeight WHERE assessmentId = ?`, [assessmentId]);
        await connection.query(`DELETE FROM assessment WHERE assessmentId = ?`, [assessmentId]);

        await connection.commit();
        return { success: true };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}


// --- Publish ---

async function publishAssessment(assessmentId, semesterId, dueDate) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [[assessment]] = await connection.query(`SELECT band FROM assessment WHERE assessmentId = ?`, [assessmentId]);
        if (!assessment) {
            await connection.rollback();
            return { success: false, reason: 'NOT_FOUND' };
        }

        const [[{ existingCount }]] = await connection.query(
            `SELECT COUNT(*) AS existingCount FROM studentAssessment WHERE assessmentId = ? AND semesterId = ?`,
            [assessmentId, semesterId]
        );
        if (existingCount > 0) {
            await connection.rollback();
            return { success: false, reason: 'ALREADY_PUBLISHED' };
        }

        const students = await getStudentsByBandAndSemester(connection, assessment.band, semesterId);
        if (students.length === 0) {
            await connection.rollback();
            return { success: false, reason: 'NO_STUDENTS' };
        }

        const values = students.map(s => [s.studentId, assessmentId, semesterId, 'Assigned', dueDate]);
        await connection.query(
            `INSERT INTO studentAssessment (studentId, assessmentId, semesterId, status, dueDate) VALUES ?`,
            [values]
        );

        await connection.commit();
        return { success: true, studentsAssigned: students.length };

    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function unpublishAssessment(assessmentId, semesterId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [[{ existingCount }]] = await connection.query(
            `SELECT COUNT(*) AS existingCount FROM studentAssessment WHERE assessmentId = ? AND semesterId = ?`,
            [assessmentId, semesterId]
        );
        if (existingCount === 0) {
            await connection.rollback();
            return { success: false, reason: 'NOT_PUBLISHED' };
        }

        const [[{ submittedCount }]] = await connection.query(
            `SELECT COUNT(*) AS submittedCount FROM studentAssessment WHERE assessmentId = ? AND semesterId = ? AND status IN ('submitted','graded')`,
            [assessmentId, semesterId]
        );
        if (submittedCount > 0) {
            await connection.rollback();
            return { success: false, reason: 'HAS_SUBMISSIONS' };
        }

        await connection.query(`DELETE FROM studentAssessment WHERE assessmentId = ? AND semesterId = ?`, [assessmentId, semesterId]);

        await connection.commit();
        return { success: true };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

module.exports = {
    getSemAndBandBySemBandId, createAssessment, updateAssessment, getAssessmentById, getAllAssessmentsFiltered, deleteAssessment, publishAssessment, unpublishAssessment
};