const Student = require('../models/band');

class StudentController {
    constructor(model = Student) {
        this.model = model;
    }

    async searchStudents(criteria = {}, context = {}) {
        if (context.cohort) {
            // Band enrollment search only shows students with a valid movement
            const candidates = await this.model.getEligibleStudents(context.cohort);
            return this.filterStudents(candidates, criteria);
        }
        return this.filterStudents(await this.model.getStudents(), criteria);
    }

    async selectStudent(studentId) {
        const student = (await this.model.getStudents())
            .find((candidate) => String(candidate.id) === String(studentId));
        return student || null;
    }

    async excludeStudentsEnrolledInSemester(semesterId) {
        // Set makes the enrolled student lookup quick and avoids duplicates
        return new Set(await this.model.getStudentIdsEnrolledInSemester(semesterId));
    }

    filterStudents(students, criteria) {
        const name = String(criteria.name || '').trim().toLowerCase();
        const centre = String(criteria.centre || '').trim();
        const schoolLevel = String(criteria.schoolLevel || '').trim();
        const movement = String(criteria.movement || '').trim();
        return students.filter((student) =>
            (!name || student.name.toLowerCase().includes(name)) &&
            (!centre || student.centre === centre) &&
            (!schoolLevel || student.schoolLevel === schoolLevel) &&
            (!movement || student.movement === movement)
        );
    }
}

const controller = new StudentController();
module.exports = controller;
module.exports.StudentController = StudentController;

