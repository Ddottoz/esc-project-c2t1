const pool = require('./db');

const BAND_SEQUENCE = ['Band A1', 'Band A2', 'Band A3', 'Band B4', 'Band B5', 'Band B6', 'Band C7', 'Band C8', 'Band C9'];

function bandCode(name) {
    return String(name).replace(/^Band\s+/i, '').toUpperCase();
}

function bandName(code) {
    return `Band ${code}`;
}

function semesterNumber(semester) {
    const match = String(semester).match(/(1|2)$/);
    return match ? Number(match[1]) : NaN;
}

function semesterName(number) {
    return `Semester ${number}`;
}

function makeBandId(code, year, number) {
    return `band-${String(code).toLowerCase()}-${year}-s${number}`;
}

function assessmentName(row) {
    return row.component === 'PA / Phonics' ? `PA: ${row.assessmentType}` : row.assessmentType;
}

function allocateDefaultWeights(assessments) {
    if (!assessments.length) return assessments;

    const totalPoints = assessments.reduce((sum, item) => sum + (item.maxPoints > 0 ? item.maxPoints : 0), 0);
    const rawWeights = assessments.map((item) => totalPoints > 0
        ? (item.maxPoints > 0 ? item.maxPoints / totalPoints * 100 : 0)
        : 100 / assessments.length);
    let assigned = 0;

    return assessments.map((item, index) => {
        const weight = index === assessments.length - 1
            ? Math.round((100 - assigned) * 10000) / 10000
            : Math.round(rawWeights[index] * 10000) / 10000;
        assigned += weight;
        return {...item, weight};
    });
}

function mapBandRow(row) {
    return {
        id: row.id,
        name: bandName(row.band),
        bandCode: row.band,
        semesterId: Number(row.semesterId),
        year: Number(row.year),
        semester: semesterName(row.semesterNo),
        description: row.description || '',
        assessments: [],
        educators: [],
        enrollments: [],
        studentCount: Number(row.studentCount || 0),
        pendingReviews: Number(row.pendingReviews || 0)
    };
}

async function getBands() {
    const [rows] = await pool.query(`
        SELECT
            sb.semesterBandId AS id,
            sb.band,
            sb.semesterId,
            s.academicYear AS year,
            s.semesterNo,
            sb.description,
            COUNT(DISTINCT ssb.studentId) AS studentCount,
            COUNT(DISTINCT CASE
                WHEN a.assessmentId IS NOT NULL AND sa.status IN ('Submitted', 'Analysing')
                THEN sa.studentAssessmentId
            END) AS pendingReviews
        FROM semesterBand sb
        INNER JOIN semester s ON s.semesterId = sb.semesterId
        LEFT JOIN studentSemBand ssb
            ON ssb.semesterId = sb.semesterId AND ssb.band = sb.band
        LEFT JOIN studentAssessment sa
            ON sa.studentId = ssb.studentId AND sa.semesterId = sb.semesterId
        LEFT JOIN assessment a
            ON a.assessmentId = sa.assessmentId AND a.band = sb.band
        GROUP BY sb.semesterBandId, sb.band, sb.semesterId, s.academicYear, s.semesterNo, sb.description
        ORDER BY s.academicYear DESC, s.semesterNo DESC, sb.band
    `);
    return rows.map(mapBandRow);
}

async function getBand(id) {
    const [rows] = await pool.query(`
        SELECT sb.semesterBandId AS id, sb.band, sb.semesterId,
               s.academicYear AS year, s.semesterNo, sb.description
        FROM semesterBand sb
        INNER JOIN semester s ON s.semesterId = sb.semesterId
        WHERE sb.semesterBandId = ?
    `, [id]);
    if (!rows.length) return null;

    const band = mapBandRow(rows[0]);
    const [assessmentRows, educatorRows, enrollmentRows, resultRows] = await Promise.all([
        pool.query(`
            SELECT a.assessmentId AS id, a.assessmentType, a.component,
                   a.totalMark AS maxPoints, a.passingMark AS passingPoints,
                   sbaw.weight
            FROM assessment a
            LEFT JOIN semesterBandAssessmentWeight sbaw
                ON sbaw.assessmentId = a.assessmentId AND sbaw.semesterBandId = ?
            WHERE a.band = ?
            ORDER BY a.assessmentId
        `, [band.id, band.bandCode]),
        pool.query(`
            SELECT semesterBandEducatorId AS id, educatorName AS name, centre, role
            FROM semesterBandEducator
            WHERE semesterBandId = ?
            ORDER BY semesterBandEducatorId
        `, [band.id]),
        pool.query(`
            SELECT st.studentId AS id,
                   TRIM(CONCAT(st.firstName, ' ', COALESCE(st.lastName, ''))) AS name,
                   c.centreName AS centre,
                   st.schoolLevel,
                   ssb.movement
            FROM studentSemBand ssb
            INNER JOIN student st ON st.studentId = ssb.studentId
            LEFT JOIN centre c ON c.centreId = st.centreId
            WHERE ssb.semesterId = ? AND ssb.band = ?
        `, [band.semesterId, band.bandCode]),
        pool.query(`
            SELECT sa.studentId, sa.assessmentId, sa.studentAssessmentId,
                   UPPER(sa.status) AS status, sa.score, latest.submittedAt,
                   CASE WHEN analysis.submissionId IS NULL THEN 0 ELSE 1 END AS hasAnalysis
            FROM studentAssessment sa
            INNER JOIN assessment a ON a.assessmentId = sa.assessmentId
            INNER JOIN studentSemBand ssb
                ON ssb.studentId = sa.studentId
                AND ssb.semesterId = sa.semesterId
                AND ssb.band = a.band
            LEFT JOIN (
                SELECT studentAssessmentId, MAX(submittedDate) AS submittedAt
                FROM assessmentSubmission
                GROUP BY studentAssessmentId
            ) latest ON latest.studentAssessmentId = sa.studentAssessmentId
            LEFT JOIN assessment_analysis analysis
                ON analysis.submissionId = sa.studentAssessmentId
            WHERE sa.semesterId = ? AND a.band = ?
        `, [band.semesterId, band.bandCode])
    ]);

    band.assessments = assessmentRows[0].map((row) => ({
        id: String(row.id),
        name: assessmentName(row),
        assessmentType: row.assessmentType,
        maxPoints: row.maxPoints === null ? 0 : Number(row.maxPoints),
        passingPoints: Number(row.passingPoints),
        weight: row.weight === null ? null : Number(row.weight)
    }));
    if (band.assessments.every((item) => item.weight === null)) {
        band.assessments = allocateDefaultWeights(band.assessments);
    } else {
        band.assessments = band.assessments.map((item) => ({...item, weight: item.weight ?? 0}));
    }

    const submissionsByStudent = new Map();
    resultRows[0].forEach((row) => {
        const studentId = String(row.studentId);
        if (!submissionsByStudent.has(studentId)) submissionsByStudent.set(studentId, {});
        submissionsByStudent.get(studentId)[String(row.assessmentId)] = {
            studentAssessmentId: String(row.studentAssessmentId),
            hasAnalysis: Boolean(row.hasAnalysis),
            status: row.status,
            score: row.score === null ? null : Number(row.score),
            submittedAt: row.submittedAt
        };
    });

    band.educators = educatorRows[0];
    band.enrollments = enrollmentRows[0].map((student) => ({
        // current DB uses student + semester as the enrollment identity
        enrollmentId: `${band.id}:${student.id}`,
        studentId: String(student.id),
        cohortId: band.id,
        semesterId: band.semesterId,
        movement: student.movement || 'Continue',
        student: {
            id: String(student.id),
            name: student.name,
            centre: student.centre || '',
            schoolLevel: student.schoolLevel || ''
        },
        submissions: submissionsByStudent.get(String(student.id)) || {}
    }));
    band.studentCount = band.enrollments.length;
    return band;
}

async function getStudents() {
    const [rows] = await pool.query(`
        SELECT st.studentId AS id,
               TRIM(CONCAT(st.firstName, ' ', COALESCE(st.lastName, ''))) AS name,
               c.centreName AS centre,
               st.schoolLevel
        FROM student st
        LEFT JOIN centre c ON c.centreId = st.centreId
        ORDER BY st.firstName, st.lastName
    `);
    return rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        centre: row.centre || '',
        schoolLevel: row.schoolLevel || ''
    }));
}

async function getStudentIdsEnrolledInSemester(semesterId) {
    // used to hide students who already have a Band for this semester
    const [rows] = await pool.query(
        'SELECT DISTINCT studentId FROM studentSemBand WHERE semesterId = ?',
        [semesterId]
    );
    return rows.map((row) => String(row.studentId));
}

async function bandExists(name, year, semester, excludeId = null) {
    const [rows] = await pool.query(`
        SELECT sb.semesterBandId
        FROM semesterBand sb
        INNER JOIN semester s ON s.semesterId = sb.semesterId
        WHERE sb.band = ? AND s.academicYear = ? AND s.semesterNo = ?
          AND (? IS NULL OR sb.semesterBandId <> ?)
        LIMIT 1
    `, [bandCode(name), Number(year), semesterNumber(semester), excludeId, excludeId]);
    return rows.length > 0;
}

async function getStudentEnrollmentForTerm(studentId, year, semester, excludeBandId = null) {
    const [rows] = await pool.query(`
        SELECT sb.semesterBandId AS id, sb.band, s.academicYear AS year, s.semesterNo
        FROM studentSemBand ssb
        INNER JOIN semester s ON s.semesterId = ssb.semesterId
        INNER JOIN semesterBand sb ON sb.semesterId = ssb.semesterId AND sb.band = ssb.band
        WHERE ssb.studentId = ? AND s.academicYear = ? AND s.semesterNo = ?
          AND (? IS NULL OR sb.semesterBandId <> ?)
        LIMIT 1
    `, [studentId, Number(year), semesterNumber(semester), excludeBandId, excludeBandId]);
    return rows.length ? mapBandRow(rows[0]) : null;
}

async function getEnrollmentConflictsForTerm(bandId, year, semester) {
    const [rows] = await pool.query(`
        SELECT currentEnrollment.studentId, otherBand.semesterBandId AS bandId,
               otherEnrollment.band, targetSemester.academicYear AS year,
               targetSemester.semesterNo
        FROM semesterBand currentBand
        INNER JOIN studentSemBand currentEnrollment
            ON currentEnrollment.semesterId = currentBand.semesterId
            AND currentEnrollment.band = currentBand.band
        INNER JOIN semester targetSemester
            ON targetSemester.academicYear = ? AND targetSemester.semesterNo = ?
        INNER JOIN studentSemBand otherEnrollment
            ON otherEnrollment.studentId = currentEnrollment.studentId
            AND otherEnrollment.semesterId = targetSemester.semesterId
        INNER JOIN semesterBand otherBand
            ON otherBand.semesterId = otherEnrollment.semesterId
            AND otherBand.band = otherEnrollment.band
        WHERE currentBand.semesterBandId = ?
          AND otherBand.semesterBandId <> currentBand.semesterBandId
    `, [Number(year), semesterNumber(semester), bandId]);
    return rows.map((row) => ({
        studentId: String(row.studentId),
        band: {
            id: row.bandId,
            name: bandName(row.band),
            year: Number(row.year),
            semester: semesterName(row.semesterNo)
        }
    }));
}

async function ensureSemester(connection, year, semester) {
    const number = semesterNumber(semester);
    const semesterId = Number(year) * 100 + number;
    await connection.query(`
        INSERT INTO semester (semesterId, academicYear, semesterNo)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE academicYear = VALUES(academicYear), semesterNo = VALUES(semesterNo)
    `, [semesterId, Number(year), number]);
    return semesterId;
}

async function createBand(input) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const code = bandCode(input.name);
        const number = semesterNumber(input.semester);
        const semesterId = await ensureSemester(connection, input.year, input.semester);
        const id = makeBandId(code, Number(input.year), number);
        await connection.query(`
            INSERT INTO semesterBand (semesterBandId, semesterId, band, description)
            VALUES (?, ?, ?, ?)
        `, [id, semesterId, code, input.description || '']);
        await connection.commit();
        return getBand(id);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function replaceBandSettings(connection, id, input) {
    await connection.query('DELETE FROM semesterBandEducator WHERE semesterBandId = ?', [id]);
    for (const educator of input.educators) {
        await connection.query(`
            INSERT INTO semesterBandEducator (semesterBandId, educatorName, centre, role)
            VALUES (?, ?, ?, ?)
        `, [id, educator.name, educator.centre, educator.role]);
    }

    for (const [assessmentId, weight] of Object.entries(input.weights)) {
        await connection.query(`
            INSERT INTO semesterBandAssessmentWeight (semesterBandId, assessmentId, weight)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE weight = VALUES(weight)
        `, [id, assessmentId, Number(weight)]);
    }
}

async function updateBand(id, input) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query(
            'SELECT semesterId, band FROM semesterBand WHERE semesterBandId = ? FOR UPDATE',
            [id]
        );
        if (!rows.length) {
            await connection.rollback();
            return null;
        }

        const oldSemesterId = Number(rows[0].semesterId);
        const code = rows[0].band;
        const newSemesterId = await ensureSemester(connection, input.year, input.semester);

        if (oldSemesterId !== newSemesterId) {
            const [enrolled] = await connection.query(
                'SELECT studentId FROM studentSemBand WHERE semesterId = ? AND band = ?',
                [oldSemesterId, code]
            );
            const studentIds = enrolled.map((row) => row.studentId);
            if (studentIds.length) {
                await connection.query(`
                    UPDATE studentAssessment sa
                    INNER JOIN assessment a ON a.assessmentId = sa.assessmentId
                    SET sa.semesterId = ?
                    WHERE sa.semesterId = ? AND a.band = ? AND sa.studentId IN (?)
                `, [newSemesterId, oldSemesterId, code, studentIds]);
                await connection.query(
                    'UPDATE studentSemBand SET semesterId = ? WHERE semesterId = ? AND band = ?',
                    [newSemesterId, oldSemesterId, code]
                );
                await connection.query(`
                    UPDATE student
                    SET currentSemester = ?
                    WHERE currentSemester = ? AND currentBand = ? AND studentId IN (?)
                `, [newSemesterId, oldSemesterId, code, studentIds]);
            }
        }

        await connection.query(
            'UPDATE semesterBand SET semesterId = ?, description = ? WHERE semesterBandId = ?',
            [newSemesterId, input.description || '', id]
        );
        await replaceBandSettings(connection, id, input);
        await connection.commit();
        return getBand(id);
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') return null;
        throw error;
    } finally {
        connection.release();
    }
}

async function deleteStudentAssessments(connection, semesterId, code, studentIds) {
    if (!studentIds.length) return;
    const [rows] = await connection.query(`
        SELECT sa.studentAssessmentId
        FROM studentAssessment sa
        INNER JOIN assessment a ON a.assessmentId = sa.assessmentId
        WHERE sa.semesterId = ? AND a.band = ? AND sa.studentId IN (?)
    `, [semesterId, code, studentIds]);
    const ids = rows.map((row) => row.studentAssessmentId);
    if (!ids.length) return;

    await connection.query('DELETE FROM assessment_analysis_error WHERE submissionId IN (?)', [ids]);
    await connection.query('DELETE FROM assessment_analysis WHERE submissionId IN (?)', [ids]);
    await connection.query('DELETE FROM assessmentSubmission WHERE studentAssessmentId IN (?)', [ids]);
    await connection.query('DELETE FROM studentAssessment WHERE studentAssessmentId IN (?)', [ids]);
}

async function deleteBand(id) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query(
            'SELECT semesterId, band FROM semesterBand WHERE semesterBandId = ? FOR UPDATE',
            [id]
        );
        if (!rows.length) {
            await connection.rollback();
            return false;
        }
        const {semesterId, band: code} = rows[0];
        const [enrolled] = await connection.query(
            'SELECT studentId FROM studentSemBand WHERE semesterId = ? AND band = ?',
            [semesterId, code]
        );
        const studentIds = enrolled.map((row) => row.studentId);
        await deleteStudentAssessments(connection, semesterId, code, studentIds);
        await connection.query('DELETE FROM studentSemBand WHERE semesterId = ? AND band = ?', [semesterId, code]);
        if (studentIds.length) {
            await connection.query(`
                UPDATE student SET currentBand = NULL
                WHERE currentSemester = ? AND currentBand = ? AND studentId IN (?)
            `, [semesterId, code, studentIds]);
        }
        await connection.query('DELETE FROM semesterBand WHERE semesterBandId = ?', [id]);
        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function addEnrollment(bandId, studentId, movement) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [bands] = await connection.query(
            'SELECT semesterId, band FROM semesterBand WHERE semesterBandId = ? FOR UPDATE',
            [bandId]
        );
        if (!bands.length) {
            await connection.rollback();
            return false;
        }
        const {semesterId, band: code} = bands[0];
        await connection.query(
            'INSERT INTO studentSemBand (semesterId, studentId, band, movement) VALUES (?, ?, ?, ?)',
            [semesterId, studentId, code, movement]
        );
        await connection.query(`
            INSERT INTO studentAssessment (studentId, assessmentId, semesterId, score, status, dueDate)
            SELECT ?, a.assessmentId, ?, NULL, 'Missing', NULL
            FROM assessment a
            WHERE a.band = ?
              AND NOT EXISTS (
                  SELECT 1 FROM studentAssessment sa
                  WHERE sa.studentId = ? AND sa.assessmentId = a.assessmentId AND sa.semesterId = ?
              )
        `, [studentId, semesterId, code, studentId, semesterId]);
        await connection.query(`
            UPDATE student
            SET currentSemester = ?, currentBand = ?
            WHERE studentId = ? AND currentSemester <= ?
        `, [semesterId, code, studentId, semesterId]);
        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_NO_REFERENCED_ROW_2') return false;
        throw error;
    } finally {
        connection.release();
    }
}

async function removeEnrollment(bandId, studentId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [bands] = await connection.query(
            'SELECT semesterId, band FROM semesterBand WHERE semesterBandId = ? FOR UPDATE',
            [bandId]
        );
        if (!bands.length) {
            await connection.rollback();
            return false;
        }
        const {semesterId, band: code} = bands[0];
        await deleteStudentAssessments(connection, semesterId, code, [studentId]);
        const [result] = await connection.query(
            'DELETE FROM studentSemBand WHERE semesterId = ? AND studentId = ? AND band = ?',
            [semesterId, studentId, code]
        );
        await connection.query(`
            UPDATE student SET currentBand = NULL
            WHERE studentId = ? AND currentSemester = ? AND currentBand = ?
        `, [studentId, semesterId, code]);
        await connection.commit();
        return result.affectedRows > 0;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

function getWeightedScore(assessments, submissions) {
    return assessments.reduce((total, assessment) => {
        const submission = submissions[assessment.id];
        // missing or ungraded scores count as 0
        if (!submission || submission.status !== 'GRADED' || !Number.isFinite(submission.score)) return total;
        if (!Number.isFinite(assessment.maxPoints) || assessment.maxPoints <= 0) return total;
        if (!Number.isFinite(assessment.weight)) return total;
        return total + (submission.score / assessment.maxPoints) * assessment.weight;
    }, 0);
}

function getRoster(band) {
    return band.enrollments.map((enrollment) => {
        const submissions = band.assessments.map((assessment) => enrollment.submissions[assessment.id]);
        const submitted = submissions.filter((item) => item && (
            item.submittedAt || !['MISSING', 'ASSIGNED'].includes(item.status)
        )).length;
        const graded = submissions.filter((item) => item && item.status === 'GRADED').length;
        const weightedScore = getWeightedScore(band.assessments, enrollment.submissions);
        return {
            ...enrollment.student,
            submissionsPercent: band.assessments.length ? Math.round(submitted / band.assessments.length * 100) : 0,
            gradedPercent: band.assessments.length ? Math.round(graded / band.assessments.length * 100) : 0,
            pendingReview: submitted - graded,
            scorePercent: band.assessments.length ? Math.round(weightedScore) : null
        };
    }).sort((a, b) => {
        const aLastName = a.name.trim().split(/\s+/).at(-1);
        const bLastName = b.name.trim().split(/\s+/).at(-1);
        return aLastName.localeCompare(bLastName) || a.name.localeCompare(b.name);
    });
}

function getStudentDashboard(band, studentId) {
    const enrollment = band.enrollments.find((item) => item.studentId === String(studentId));
    if (!enrollment) return null;
    const assessments = band.assessments.map((assessment) => ({
        ...assessment,
        submission: enrollment.submissions[assessment.id] || {status: 'MISSING', score: null, submittedAt: null}
    }));
    const weightedScore = getWeightedScore(band.assessments, enrollment.submissions);
    const earned = Math.round(weightedScore * 100) / 100;
    const required = 90;
    // every assessment must be graded before the result can be PASS
    const meetsEachRubric = assessments.every((item) =>
        item.submission.status === 'GRADED' &&
        Number.isFinite(item.submission.score) && item.submission.score >= item.passingPoints
    );
    return {
        student: enrollment.student,
        assessments,
        earned,
        required,
        passed: assessments.length > 0 && weightedScore >= required && meetsEachRubric
    };
}

async function getEligibleStudents(targetBand) {
    const targetRank = targetBand.year * 2 + semesterNumber(targetBand.semester);
    const targetIndex = BAND_SEQUENCE.indexOf(targetBand.name);
    const relevantBandCodes = BAND_SEQUENCE
        .slice(Math.max(0, targetIndex - 1), Math.min(BAND_SEQUENCE.length, targetIndex + 2))
        .map(bandCode);
    const placeholders = relevantBandCodes.map(() => '?').join(', ');
    const [rows] = await pool.query(`
        WITH ranked AS (
            SELECT ssb.studentId, ssb.band, ssb.semesterId,
                   s.academicYear, s.semesterNo,
                   ROW_NUMBER() OVER (
                       PARTITION BY ssb.studentId
                       ORDER BY s.academicYear DESC, s.semesterNo DESC
                   ) AS rowNumber
            FROM studentSemBand ssb
            INNER JOIN semester s ON s.semesterId = ssb.semesterId
            WHERE (s.academicYear * 2 + s.semesterNo) < ?
        ),
        latest AS (
            SELECT * FROM ranked WHERE rowNumber = 1
        )
        SELECT st.studentId AS id,
               TRIM(CONCAT(st.firstName, ' ', COALESCE(st.lastName, ''))) AS name,
               c.centreName AS centre, st.schoolLevel,
               latest.band, latest.semesterId,
               latest.academicYear, latest.semesterNo,
               sb.semesterBandId,
               a.assessmentId, a.assessmentType, a.component,
               a.totalMark AS maxPoints, a.passingMark AS passingPoints,
               sbaw.weight, sa.studentAssessmentId, sa.score
        FROM latest
        INNER JOIN student st ON st.studentId = latest.studentId
        LEFT JOIN centre c ON c.centreId = st.centreId
        INNER JOIN semesterBand sb
            ON sb.semesterId = latest.semesterId AND sb.band = latest.band
        LEFT JOIN assessment a ON a.band = latest.band
        LEFT JOIN semesterBandAssessmentWeight sbaw
            ON sbaw.semesterBandId = sb.semesterBandId
            AND sbaw.assessmentId = a.assessmentId
        LEFT JOIN studentAssessment sa
            ON sa.studentId = latest.studentId
            AND sa.semesterId = latest.semesterId
            AND sa.assessmentId = a.assessmentId
        WHERE latest.band IN (${placeholders})
          AND NOT EXISTS (
              SELECT 1 FROM studentSemBand targetEnrollment
              WHERE targetEnrollment.studentId = latest.studentId
                AND targetEnrollment.semesterId = ?
          )
        ORDER BY latest.studentId, a.assessmentId, sa.studentAssessmentId
    `, [targetRank, ...relevantBandCodes, targetBand.semesterId]);

    const candidates = new Map();
    const assessmentsByBand = new Map();
    rows.forEach((row) => {
        const studentId = String(row.id);
        if (!candidates.has(studentId)) {
            candidates.set(studentId, {
                id: studentId,
                name: row.name,
                centre: row.centre || '',
                schoolLevel: row.schoolLevel || '',
                band: row.band,
                semesterBandId: row.semesterBandId,
                academicYear: Number(row.academicYear),
                semesterNo: Number(row.semesterNo),
                submissions: {}
            });
        }

        if (row.assessmentId !== null) {
            if (!assessmentsByBand.has(row.semesterBandId)) {
                assessmentsByBand.set(row.semesterBandId, new Map());
            }
            assessmentsByBand.get(row.semesterBandId).set(String(row.assessmentId), {
                id: String(row.assessmentId),
                name: assessmentName(row),
                maxPoints: row.maxPoints === null ? 0 : Number(row.maxPoints),
                passingPoints: Number(row.passingPoints),
                weight: row.weight === null ? null : Number(row.weight)
            });
            candidates.get(studentId).submissions[String(row.assessmentId)] = {
                status: 'GRADED',
                score: row.score === null ? null : Number(row.score),
                submittedAt: null
            };
        }
    });

    const weightedAssessmentsByBand = new Map();
    assessmentsByBand.forEach((assessmentMap, id) => {
        let assessments = [...assessmentMap.values()];
        if (assessments.every((item) => item.weight === null)) {
            assessments = allocateDefaultWeights(assessments);
        } else {
            assessments = assessments.map((item) => ({...item, weight: item.weight ?? 0}));
        }
        weightedAssessmentsByBand.set(id, assessments);
    });

    return [...candidates.values()].map((candidate) => {
        const assessments = weightedAssessmentsByBand.get(candidate.semesterBandId) || [];
        const latestBand = {
            assessments,
            enrollments: [{
                studentId: candidate.id,
                student: {
                    id: candidate.id,
                    name: candidate.name,
                    centre: candidate.centre,
                    schoolLevel: candidate.schoolLevel
                },
                submissions: candidate.submissions
            }]
        };
        const dashboard = getStudentDashboard(latestBand, candidate.id);
        const difference = targetIndex - BAND_SEQUENCE.indexOf(bandName(candidate.band));
        if (Math.abs(difference) > 1) return null;
        const movement = difference === 1 ? 'Advance' : difference === 0 ? 'Continue' : 'Lower';
        const latestStatus = dashboard && dashboard.passed ? 'PASS' : 'FAIL';
        if (movement === 'Advance' && latestStatus !== 'PASS') return null;
        return {
            id: candidate.id,
            name: candidate.name,
            centre: candidate.centre,
            schoolLevel: candidate.schoolLevel,
            currentBand: bandName(candidate.band),
            currentTerm: `${candidate.academicYear} ${semesterName(candidate.semesterNo)}`,
            latestStatus,
            movement
        };
    }).filter(Boolean);
}

async function getPastBands(studentId, currentBand) {
    const [rows] = await pool.query(`
        SELECT sb.semesterBandId, ssb.band, s.academicYear, s.semesterNo
        FROM studentSemBand ssb
        INNER JOIN semester s ON s.semesterId = ssb.semesterId
        INNER JOIN semesterBand sb ON sb.semesterId = ssb.semesterId AND sb.band = ssb.band
        WHERE ssb.studentId = ?
          AND (s.academicYear * 2 + s.semesterNo) < ?
        ORDER BY s.academicYear DESC, s.semesterNo DESC
    `, [studentId, currentBand.year * 2 + semesterNumber(currentBand.semester)]);

    return rows.map((row) => ({
        studentId: String(studentId),
        term: `${row.academicYear} ${semesterName(row.semesterNo)}`,
        band: bandName(row.band),
        bandId: row.semesterBandId
    }));
}

module.exports = {
    getBands,
    getBand,
    getStudents,
    getStudentIdsEnrolledInSemester,
    bandExists,
    getStudentEnrollmentForTerm,
    getEnrollmentConflictsForTerm,
    createBand,
    updateBand,
    deleteBand,
    addEnrollment,
    removeEnrollment,
    getRoster,
    getStudentDashboard,
    getEligibleStudents,
    getPastBands
};

// same method names as the solution diagram, old names still work too
module.exports.createBandCohort = createBand;
module.exports.updateBandSettings = updateBand;
module.exports.deleteBandCohort = deleteBand;
module.exports.createEnrollment = addEnrollment;
module.exports.deleteEnrollment = removeEnrollment;
