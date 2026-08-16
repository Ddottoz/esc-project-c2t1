const {StudentController} = require('../../controllers/StudentController');
const {StudentDashboardController} = require('../../controllers/StudentDashboardController');

describe('UC15 StudentController Band search', () => {
    test('15.1.7: filters all supplied criteria without mutating candidates', async () => {
        const candidates = [
            {id: '1', name: 'Alice Tan', centre: 'Centre 1', schoolLevel: 'P5', movement: 'Continue'},
            {id: '3', name: 'Cara Lim', centre: 'Centre 1', schoolLevel: 'P6', movement: 'Advance'}
        ];
        const snapshot = structuredClone(candidates);
        const model = {getEligibleStudents: jest.fn().mockResolvedValue(candidates), getStudents: jest.fn()};
        const controller = new StudentController(model);

        await expect(controller.searchStudents(
            {name: ' cara ', centre: 'Centre 1', schoolLevel: 'P6', movement: 'Advance'},
            {type: 'band-enrollment', cohort: {id: '42'}}
        )).resolves.toEqual([candidates[1]]);
        expect(candidates).toEqual(snapshot);
        expect(model.getStudents).not.toHaveBeenCalled();
    });

    test('15.1.8: propagates an eligibility lookup error', async () => {
        const error = new Error('DB unavailable');
        const controller = new StudentController({getEligibleStudents: jest.fn().mockRejectedValue(error)});
        await expect(controller.searchStudents({}, {cohort: {id: '42'}})).rejects.toBe(error);
    });
});

const assessments = [
    {id: '101', maxPoints: 50, passingPoints: 40, weight: 50},
    {id: '102', maxPoints: 50, passingPoints: 40, weight: 50}
];
function enrollment(scores = [45, 48]) {
    return {
        studentId: '3', student: {id: '3', name: 'Cara Lim'},
        submissions: {
            '101': {status: 'GRADED', score: scores[0]},
            '102': {status: 'GRADED', score: scores[1]}
        }
    };
}

describe('UC16 StudentDashboardController calculations', () => {
    const controller = new StudentDashboardController({});

    test('16.1.5: calculates 93 points and PASS', () => {
        const data = enrollment();
        const assessmentInput = structuredClone(assessments);
        const beforeData = structuredClone(data);
        expect(controller.calculateEarnedPoints(data, assessmentInput)).toBe(93);
        expect(controller.evaluateBandResult(data, assessmentInput)).toBe('PASS');
        expect(data).toEqual(beforeData);
        expect(assessmentInput).toEqual(assessments);
    });

    test('16.1.6: returns FAIL when one rubric fails despite total above 90', () => {
        const data = enrollment([39, 53]);
        expect(controller.calculateEarnedPoints(data, assessments)).toBe(92);
        expect(controller.evaluateBandResult(data, assessments)).toBe('FAIL');
    });

    test('16.1.11: missing, ungraded, non-numeric and zero-max scores contribute zero', () => {
        const invalidAssessments = [
            {id: '1', maxPoints: 50, passingPoints: 1, weight: 25},
            {id: '2', maxPoints: 50, passingPoints: 1, weight: 25},
            {id: '3', maxPoints: 50, passingPoints: 1, weight: 25},
            {id: '4', maxPoints: 0, passingPoints: 1, weight: 25},
            {id: '5', maxPoints: 50, passingPoints: 1, weight: 25}
        ];
        const data = {submissions: {
            '2': {status: 'ASSIGNED', score: 40},
            '3': {status: 'GRADED', score: '45'},
            '4': {status: 'GRADED', score: 45},
            '5': {status: 'GRADED', score: NaN}
        }};
        const beforeAssessments = structuredClone(invalidAssessments);
        const beforeStatuses = Object.fromEntries(Object.entries(data.submissions)
            .map(([id, submission]) => [id, submission.status]));
        expect(controller.calculateEarnedPoints(data, invalidAssessments)).toBe(0);
        expect(invalidAssessments).toEqual(beforeAssessments);
        expect(Object.fromEntries(Object.entries(data.submissions)
            .map(([id, submission]) => [id, submission.status]))).toEqual(beforeStatuses);
        expect(Number.isNaN(data.submissions['5'].score)).toBe(true);
    });

    test('16.1.12: enforces the 90-point and non-empty boundaries', () => {
        const one = [{id: '1', maxPoints: 100, passingPoints: 50, weight: 100}];
        const result = (score) => controller.evaluateBandResult(
            {submissions: {'1': {status: 'GRADED', score}}}, one
        );
        expect(result(89.99)).toBe('FAIL');
        expect(result(90)).toBe('PASS');
        expect(result(90.01)).toBe('PASS');
        expect(controller.evaluateBandResult({submissions: {}}, [])).toBe('FAIL');
    });
});

describe('UC16 StudentDashboardController assembly/history', () => {
    test('returns null for missing Band or enrollment and normalizes missing submissions', async () => {
        const missing = new StudentDashboardController({getBand: jest.fn().mockResolvedValue(null)});
        await expect(missing.getDashboard('3', '999')).resolves.toBeNull();

        const noEnrollment = new StudentDashboardController({
            getBand: jest.fn().mockResolvedValue({assessments: [], enrollments: []})
        });
        await expect(noEnrollment.getDashboard('3', '42')).resolves.toBeNull();
    });

    test('16.1.13: calculates status for each past Band', async () => {
        const pastAssessment = [{id: '1', maxPoints: 100, passingPoints: 50, weight: 100}];
        const history = [{bandId: '20'}, {bandId: '30'}];
        const band20 = {assessments: pastAssessment, enrollments: [{studentId: '3', submissions: {'1': {status: 'GRADED', score: 95}}}]};
        const band30 = {assessments: pastAssessment, enrollments: [{studentId: '3', submissions: {'1': {status: 'GRADED', score: 40}}}]};
        const before = structuredClone({history, band20, band30});
        const model = {
            getPastBands: jest.fn().mockResolvedValue(history),
            getBand: jest.fn()
                .mockResolvedValueOnce(band20)
                .mockResolvedValueOnce(band30)
        };
        const controller = new StudentDashboardController(model);
        await expect(controller.getPastBandHistory('3', {id: '42'})).resolves.toEqual([
            {bandId: '20', status: 'PASS'}, {bandId: '30', status: 'FAIL'}
        ]);
        expect({history, band20, band30}).toEqual(before);
    });
});
