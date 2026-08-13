const Enrollment = require('../models/band');
const studentController = require('./StudentController');
const {ValidationError} = require('./BandController');

const PLACEMENT_MOVEMENTS = Object.freeze(['Continue', 'Advance', 'Lower']);

class EnrollmentController {
    constructor(model = Enrollment, students = studentController) {
        this.model = model;
        this.students = students;
    }

    async getRoster(cohortId) {
        const cohort = await this.model.getBand(cohortId);
        return cohort ? this.model.getRoster(cohort) : null;
    }

    async getEligibleStudents(cohortId, criteria = {}) {
        const cohort = await this.model.getBand(cohortId);
        if (!cohort) return null;
        // student controller handles the Continue / Advance / Lower rules
        return this.students.searchStudents(criteria, {type: 'band-enrollment', cohort});
    }

    async addStudent(cohortId, studentId, movement) {
        const cohort = await this.model.getBand(cohortId);
        if (!cohort) return null;

        // one student can only be in one Band per semester
        const existing = await this.model.getStudentEnrollmentForTerm(
            studentId,
            cohort.year,
            cohort.semester
        );
        if (existing) {
            throw new ValidationError(
                `This student is already enrolled in ${existing.name} for ${cohort.year} ${cohort.semester}.`,
                'DUPLICATE_SEMESTER_ENROLLMENT'
            );
        }

        // re-check movement here so edited form data cannot bypass the rule
        const eligible = await this.getEligibleStudents(cohortId);
        const selected = eligible.find((student) => String(student.id) === String(studentId));
        if (!selected || !PLACEMENT_MOVEMENTS.includes(movement) || selected.movement !== movement) {
            throw new ValidationError('This student is not eligible for this Band movement.', 'INVALID_PLACEMENT');
        }

        const created = await this.model.createEnrollment(cohortId, studentId, movement);
        if (!created) {
            throw new ValidationError('The student could not be added to this Band.', 'ENROLLMENT_FAILED');
        }
        return created;
    }

    async removeStudent(cohortId, studentId) {
        return this.model.deleteEnrollment(cohortId, studentId);
    }

    async exportRosterCsv(cohortId) {
        const cohort = await this.model.getBand(cohortId);
        if (!cohort) return null;
        const rows = this.model.getRoster(cohort);
        // quote every value so commas in names do not break the CSV
        const lines = ['Name,Submissions,Graded,Pending Review,Score,Centre,School Level']
            .concat(rows.map((student) => [
                student.name,
                `${student.submissionsPercent}%`,
                `${student.gradedPercent}%`,
                student.pendingReview,
                student.scorePercent === null ? '' : `${student.scorePercent}%`,
                student.centre,
                student.schoolLevel
            ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')));
        return {filename: `${cohort.name}-enrollment.csv`, content: lines.join('\r\n')};
    }

    async validatePlacement(studentId, cohortId, movement) {
        const eligible = await this.getEligibleStudents(cohortId);
        return Boolean(eligible && eligible.some((student) =>
            String(student.id) === String(studentId) && student.movement === movement
        ));
    }
}

const controller = new EnrollmentController();
module.exports = controller;
module.exports.EnrollmentController = EnrollmentController;

