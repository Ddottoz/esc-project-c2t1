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

        // Fetch processed data from model
        const reportData = await StudentModel.generateReport(studentId, startSem, endSem);
        
        if (!reportData || !reportData.student) {
            return res.status(404).render('error', { 
                message: 'Student report not found',
                error: { status: 404 } 
            });
        }

        const { 
            student = {}, 
            assessments = [], 
            availableSemesters = [],
            activeStartSem,
            activeEndSem
        } = reportData;

        // Ensure student object is guaranteed to have 'id' property for views/partials/sidebar.ejs
        const normalizedStudent = {
            ...student,
            id: student.id || student.studentId || studentId
        };

        // Group assessments by semester and component
        const groupedBySemester = {};
        assessments.forEach(item => {
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

        // Format enrollment date safely
        if (normalizedStudent.enrolmentDate) {
            const dateObj = new Date(normalizedStudent.enrolmentDate);
            normalizedStudent.formattedEnrolmentDate = dateObj.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } else {
            normalizedStudent.formattedEnrolmentDate = 'N/A';
        }

        // Format available semesters for select dropdowns
        const formattedSemesters = availableSemesters.map(sem => {
            const rawVal = typeof sem === 'object' ? (sem.raw || sem.semesterId) : sem;
            return {
                raw: String(rawVal),
                label: typeof formatSemester === 'function' ? formatSemester(rawVal) : String(rawVal)
            };
        });

        // Use model-calculated active bounds or fallback to request params / array defaults
        const effectiveStartSem = activeStartSem || startSem || (formattedSemesters.length > 0 ? formattedSemesters[0].raw : '');
        const effectiveEndSem = activeEndSem || endSem || (formattedSemesters.length > 0 ? formattedSemesters[formattedSemesters.length - 1].raw : '');

        res.render('report', {
            // Layout & Navigation Variables for Partials
            activeTop: 'students',
            type: 'student',
            activeSide: 'progress',
            band: {
                id: normalizedStudent.currentBand || normalizedStudent.band || 'N/A',
                name: normalizedStudent.currentBand || normalizedStudent.band || 'N/A'
            },

            // Report View Data
            student: normalizedStudent,
            groupedBySemester: groupedBySemester,
            availableSemesters: formattedSemesters,
            selectedStartSem: effectiveStartSem,
            selectedEndSem: effectiveEndSem,
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

        const { student = {}, assessments = [] } = reportData;
        const groupedBySemester = {};

        assessments.forEach(item => {
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