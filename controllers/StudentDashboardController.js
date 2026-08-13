const DashboardModel = require('../models/band');

const RESULT_STATUS = Object.freeze({PASS: 'PASS', FAIL: 'FAIL'});

class StudentDashboardController {
    constructor(model = DashboardModel) {
        this.model = model;
    }

    async getDashboard(studentId, cohortId) {
        const cohort = await this.model.getBand(cohortId);
        if (!cohort) return null;
        const enrollment = cohort.enrollments.find((item) => item.studentId === String(studentId));
        if (!enrollment) return null;

        const assessments = cohort.assessments.map((assessment) => {
            const submission = enrollment.submissions[assessment.id] || {
                status: 'MISSING', score: null, submittedAt: null,
                studentAssessmentId: null, hasAnalysis: false
            };
            return {
                ...assessment,
                // no score is shown as MISSING but keeps its upload assignment
                submission: Number.isFinite(submission.score)
                    ? submission
                    : {...submission, status: 'MISSING'}
            };
        });
        const earned = this.calculateEarnedPoints(enrollment, cohort.assessments);
        const required = this.calculateRequiredPoints();
        const resultStatus = this.evaluateBandResult(enrollment, cohort.assessments);
        const pastBands = await this.getPastBandHistory(studentId, cohort);

        return {
            band: cohort,
            student: enrollment.student,
            assessments,
            earned,
            required,
            resultStatus,
            passed: resultStatus === RESULT_STATUS.PASS,
            pastBands
        };
    }

    calculateEarnedPoints(enrollment, assessments) {
        const total = assessments.reduce((earned, assessment) => {
            const submission = enrollment.submissions[assessment.id];
            // missing or ungraded scores do not add any points
            if (!submission || submission.status !== 'GRADED' || !Number.isFinite(submission.score) ||
                !Number.isFinite(assessment.maxPoints) || assessment.maxPoints <= 0 ||
                !Number.isFinite(assessment.weight)) return earned;
            return earned + (submission.score / assessment.maxPoints) * assessment.weight;
        }, 0);
        return Math.round(total * 100) / 100;
    }

    calculateRequiredPoints() {
        return 90;
    }

    evaluateBandResult(enrollment, assessments) {
        // PASS needs every graded rubric to pass and at least 90% overall
        const meetsEveryPassingRule = assessments.length > 0 && assessments.every((assessment) => {
            const submission = enrollment.submissions[assessment.id];
            return submission && submission.status === 'GRADED' &&
                Number.isFinite(submission.score) && submission.score >= assessment.passingPoints;
        });
        return meetsEveryPassingRule && this.calculateEarnedPoints(enrollment, assessments) >= 90
            ? RESULT_STATUS.PASS
            : RESULT_STATUS.FAIL;
    }

    async getPastBandHistory(studentId, currentCohort) {
        const history = await this.model.getPastBands(studentId, currentCohort);
        // use the same PASS / FAIL rule for current and past Bands
        return Promise.all(history.map(async (item) => {
            const cohort = await this.model.getBand(item.bandId);
            const enrollment = cohort && cohort.enrollments
                .find((candidate) => candidate.studentId === String(studentId));
            const status = enrollment
                ? this.evaluateBandResult(enrollment, cohort.assessments)
                : RESULT_STATUS.FAIL;
            return {...item, status};
        }));
    }
}

const controller = new StudentDashboardController();
module.exports = controller;
module.exports.StudentDashboardController = StudentDashboardController;
module.exports.RESULT_STATUS = RESULT_STATUS;
