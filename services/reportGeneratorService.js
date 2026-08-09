
const studentModel = require('../models/student'); 
const pool = require('../models/db');

async function generateReport(studentId, startDate, endDate) {
    const student = await studentModel.getStudentById(studentId);
    if (!student) throw new Error('Student Profile Not Found');

    const [submissions] = await pool.query(
        `SELECT sub.submissionId, sub.submittedDate, sub.score, sub.analysis, a.assessmentName, a.assessmentType
         FROM assessmentSubmission sub
         JOIN studentAssessment sa ON sub.studentAssessmentId = sa.studentAssessmentId
         JOIN assessment a ON sa.assessmentId = a.assessmentId
         WHERE sa.studentId = ? AND sub.submittedDate BETWEEN ? AND ?`,
        [studentId, startDate, endDate]
    );

    if (submissions.length < 5) {
        const err = new Error('Insufficient Progress Probes');
        err.code = 'INSUFFICIENT_DATA';
        throw err;
    }

    let totalScore = 0;
    const tasksAnalyzed = [];
    
    submissions.forEach(sub => {
        totalScore += parseFloat(sub.score || 0);
        tasksAnalyzed.push(`${sub.assessmentName} (${sub.assessmentType})`);
    });

    const averageScore = (totalScore / submissions.length).toFixed(2);

    // Compiled Report Model data
    return {
        studentInfo: {
            name: student.studentName,
            age: student.age,
            schoolLevel: student.schoolLevel,
            enrollmentDate: student.enrollmentDate
        },
        dateRange: { startDate, endDate },
        metrics: {
            totalProbesRun: submissions.length,
            averagePerformanceScore: averageScore,
            completedTasks: tasksAnalyzed
        },
        diagnosticSummary: "Placeholder."
    };
}

module.exports = { generateReport };