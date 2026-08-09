
const StudentModel = require('../models/student');
const { generateStudentInsight } = require('../services/aiService');

const formatSemester = (sem) => {
    if (!sem) return '';
    const str = String(sem);
    if (str.length === 6) {
        const year = str.substring(0, 4);
        const term = str.substring(4);
        return `${year} Sem ${parseInt(term, 10)}`;
    }
    return str;
};

const getStudentReport = async (req, res) => {
    try {
        const studentId = req.params.id;
        const { startSem, endSem } = req.query;

        const reportData = await StudentModel.generateReport(studentId, startSem, endSem);
        
        if (!reportData) {
            return res.status(404).render('error', { 
                message: 'Student report not found',
                error: { status: 404 } 
            });
        }

        const { student, assessments, availableSemesters } = reportData;

        const groupedBySemester = {};

        (assessments || []).forEach(item => {
            const sem = item.semesterId;
            const comp = item.component || 'General';

            if (!groupedBySemester[sem]) {
                groupedBySemester[sem] = {};
            }
            if (!groupedBySemester[sem][comp]) {
                groupedBySemester[sem][comp] = [];
            }
            groupedBySemester[sem][comp].push(item);
        });

        if (student.enrolmentDate) {
            const dateObj = new Date(student.enrolmentDate);
            student.formattedEnrolmentDate = dateObj.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } else {
            student.formattedEnrolmentDate = 'N/A';
        }

        const formattedSemesters = (availableSemesters || []).map(sem => ({
            raw: sem,
            label: formatSemester(sem)
        }));

        res.render('report', {
            student: student,
            groupedBySemester: groupedBySemester,
            availableSemesters: formattedSemesters,
            selectedStartSem: startSem || (availableSemesters[0] || ''),
            selectedEndSem: endSem || (availableSemesters[availableSemesters.length - 1] || ''),
            formatSemester: formatSemester
        });

    } catch (error) {
        console.error('Error loading report:', error);
        res.status(500).render('error', { 
            message: 'Failed to generate student report',
            error: error 
        });
    }
};

const generateAiInsight = async (req, res) => {
    try {
        const studentId = req.params.id;
        const { startSem, endSem } = req.query;

        const reportData = await StudentModel.generateReport(studentId, startSem, endSem);
        if (!reportData) {
            return res.status(404).json({ error: 'Student data not found' });
        }

        const { student, assessments } = reportData;
        const groupedBySemester = {};

        (assessments || []).forEach(item => {
            const sem = item.semesterId;
            const comp = item.component || 'General';
            if (!groupedBySemester[sem]) groupedBySemester[sem] = {};
            if (!groupedBySemester[sem][comp]) groupedBySemester[sem][comp] = [];
            groupedBySemester[sem][comp].push(item);
        });

        const aiInsight = await generateStudentInsight(student, groupedBySemester);
        res.json({ aiInsight });
    } catch (error) {
        console.error('Error generating AI insight:', error);
        res.status(500).json({ error: 'Failed to generate AI insight' });
    }
};

module.exports = { getStudentReport, generateAiInsight };
