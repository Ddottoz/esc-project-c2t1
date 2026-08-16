const {EnrollmentController} = require('../../controllers/EnrollmentController');

const cohort = {id: '42', name: 'Band B5', year: 2026, semester: 'Semester 2'};

function dependencies(overrides = {}) {
    const model = {
        getBand: jest.fn().mockResolvedValue(cohort),
        getRoster: jest.fn().mockReturnValue([{id: '3', name: 'Cara Lim'}]),
        getStudentEnrollmentForTerm: jest.fn().mockResolvedValue(null),
        createEnrollment: jest.fn().mockResolvedValue(true),
        deleteEnrollment: jest.fn().mockResolvedValue(true),
        ...overrides
    };
    const students = {searchStudents: jest.fn().mockResolvedValue([{id: '3', movement: 'Advance'}])};
    return {model, students, controller: new EnrollmentController(model, students)};
}

describe('UC15 EnrollmentController', () => {
    test('15.1.5: creates a valid enrollment', async () => {
        const {controller, model} = dependencies();
        await expect(controller.addStudent('42', '3', 'Advance')).resolves.toBe(true);
        expect(model.getStudentEnrollmentForTerm).toHaveBeenCalledWith('3', 2026, 'Semester 2');
        expect(model.createEnrollment).toHaveBeenCalledWith('42', '3', 'Advance');
    });

    test('15.1.6: rejects a mismatched movement before create', async () => {
        const {controller, model, students} = dependencies();
        students.searchStudents.mockResolvedValue([{id: '3', movement: 'Continue'}]);
        await expect(controller.addStudent('42', '3', 'Advance'))
            .rejects.toMatchObject({code: 'INVALID_PLACEMENT'});
        expect(model.createEnrollment).not.toHaveBeenCalled();
    });

    test('rejects duplicate term enrollment and false create result', async () => {
        const duplicate = dependencies({getStudentEnrollmentForTerm: jest.fn().mockResolvedValue({name: 'Band B4'})});
        await expect(duplicate.controller.addStudent('42', '3', 'Advance'))
            .rejects.toMatchObject({code: 'DUPLICATE_SEMESTER_ENROLLMENT'});
        expect(duplicate.model.createEnrollment).not.toHaveBeenCalled();

        const failed = dependencies({createEnrollment: jest.fn().mockResolvedValue(false)});
        await expect(failed.controller.addStudent('42', '3', 'Advance'))
            .rejects.toMatchObject({code: 'ENROLLMENT_FAILED'});
    });

    test('returns null when Band is missing and delegates removal', async () => {
        const missing = dependencies({getBand: jest.fn().mockResolvedValue(null)});
        await expect(missing.controller.addStudent('999', '3', 'Advance')).resolves.toBeNull();
        expect(missing.model.createEnrollment).not.toHaveBeenCalled();

        const {controller, model} = dependencies();
        await expect(controller.removeStudent('42', '3')).resolves.toBe(true);
        expect(model.deleteEnrollment).toHaveBeenCalledWith('42', '3');
    });

    test('15.1.14: exports quoted CSV values and retains Unicode', async () => {
        const {controller, model} = dependencies();
        model.getRoster.mockReturnValue([{
            name: 'Cara, "CJ" Lim', submissionsPercent: 50, gradedPercent: 25,
            pendingReview: 1, scorePercent: null, centre: '中心', schoolLevel: 'P6'
        }]);
        const file = await controller.exportRosterCsv('42');
        expect(file.filename).toBe('Band B5-enrollment.csv');
        expect(file.content).toContain('"Cara, ""CJ"" Lim"');
        expect(file.content).toContain('"中心"');
        expect(file.content).toContain('\r\n');
    });
});
