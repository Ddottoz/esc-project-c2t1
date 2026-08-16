jest.mock('../../models/db', () => ({query: jest.fn(), getConnection: jest.fn()}));
const pool = require('../../models/db');
const BandModel = require('../../models/band');

function connection() {
    return {
        beginTransaction: jest.fn().mockResolvedValue(), query: jest.fn(),
        commit: jest.fn().mockResolvedValue(), rollback: jest.fn().mockResolvedValue(), release: jest.fn()
    };
}

beforeEach(() => jest.clearAllMocks());

describe('UC13/14 Band model transactions', () => {
    test('13.1.7: creates and commits a Band', async () => {
        const db = connection();
        pool.getConnection.mockResolvedValue(db);
        db.query.mockResolvedValue({});
        pool.query
            .mockResolvedValueOnce([[{id: 'band-a1-2026-s1', band: 'A1', semesterId: 202601, year: 2026, semesterNo: 1}]])
            .mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

        await expect(BandModel.createBandCohort({
            name: 'Band A1', year: '2026', semester: 'Semester 1', description: 'Starter band'
        })).resolves.toMatchObject({id: 'band-a1-2026-s1', name: 'Band A1'});
        expect(db.beginTransaction).toHaveBeenCalledTimes(1);
        expect(db.commit).toHaveBeenCalledTimes(1);
        expect(db.rollback).not.toHaveBeenCalled();
        expect(db.release).toHaveBeenCalledTimes(1);
    });

    test('13.1.8: insert failure rolls back and rethrows', async () => {
        const db = connection();
        const error = new Error('DB unavailable');
        pool.getConnection.mockResolvedValue(db);
        db.query.mockResolvedValueOnce({}).mockRejectedValueOnce(error);
        await expect(BandModel.createBandCohort({
            name: 'Band A1', year: '2026', semester: 'Semester 1', description: ''
        })).rejects.toBe(error);
        expect(db.rollback).toHaveBeenCalledTimes(1);
        expect(db.commit).not.toHaveBeenCalled();
        expect(db.release).toHaveBeenCalledTimes(1);
    });

    test('16.1.7: maps a Band and assigns default weights totalling 100', async () => {
        pool.query
            .mockResolvedValueOnce([[{id: '42', band: 'A1', semesterId: 202601, year: 2026, semesterNo: 1}]])
            .mockResolvedValueOnce([[{id: 101, assessmentType: 'Quiz', component: 'Reading', maxPoints: 30, passingPoints: 20, weight: null},
                {id: 102, assessmentType: 'Test', component: 'Reading', maxPoints: 70, passingPoints: 40, weight: null}]])
            .mockResolvedValueOnce([[{id: 1, name: 'Alice', centre: 'Centre 1', role: 'Lead Educator'}]])
            .mockResolvedValueOnce([[{id: 3, name: 'Cara Lim', centre: 'Centre 1', schoolLevel: 'P6', movement: 'Continue'}]])
            .mockResolvedValueOnce([[{studentId: 3, assessmentId: 101, studentAssessmentId: 501, status: 'GRADED', score: 25, submittedAt: null, hasAnalysis: 1}]]);

        const result = await BandModel.getBand('42');
        expect(result.assessments.map((item) => item.weight)).toEqual([30, 70]);
        expect(result.enrollments[0].submissions['101']).toMatchObject({score: 25, hasAnalysis: true});
        expect(result.studentCount).toBe(1);
    });

    test('14.1.7: updates settings, commits, releases, and returns the updated Band', async () => {
        const db = connection();
        pool.getConnection.mockResolvedValue(db);
        db.query
            .mockResolvedValueOnce([[{semesterId: 202601, band: 'A1'}]])
            .mockResolvedValueOnce({}) // ensure semester
            .mockResolvedValueOnce({}) // update Band
            .mockResolvedValueOnce({}) // delete educators
            .mockResolvedValueOnce({}) // insert Alice
            .mockResolvedValueOnce({}) // insert Bob
            .mockResolvedValueOnce({}) // weight 101
            .mockResolvedValueOnce({}); // weight 102
        pool.query
            .mockResolvedValueOnce([[{id: '42', band: 'A1', semesterId: 202601, year: 2026, semesterNo: 1, description: 'Updated'}]])
            .mockResolvedValueOnce([[
                {id: 101, assessmentType: 'Quiz', component: 'Reading', maxPoints: 50, passingPoints: 40, weight: 40},
                {id: 102, assessmentType: 'Test', component: 'Reading', maxPoints: 50, passingPoints: 40, weight: 60}
            ]])
            .mockResolvedValueOnce([[
                {id: 1, name: 'Alice', centre: 'Centre 1', role: 'Lead Educator'},
                {id: 2, name: 'Bob', centre: 'Centre 2', role: 'Supporting Educator'}
            ]])
            .mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
        const draft = {
            year: 2026, semester: 'Semester 1', description: 'Updated', weights: {'101': 40, '102': 60},
            educators: [
                {name: 'Alice', centre: 'Centre 1', role: 'Lead Educator'},
                {name: 'Bob', centre: 'Centre 2', role: 'Supporting Educator'}
            ]
        };

        await expect(BandModel.updateBandSettings('42', draft)).resolves.toMatchObject({
            id: '42', description: 'Updated', assessments: [expect.objectContaining({id: '101', weight: 40}), expect.objectContaining({id: '102', weight: 60})],
            educators: draft.educators.map((item, index) => ({id: index + 1, ...item}))
        });
        expect(db.beginTransaction).toHaveBeenCalledTimes(1);
        expect(db.commit).toHaveBeenCalledTimes(1);
        expect(db.rollback).not.toHaveBeenCalled();
        expect(db.release).toHaveBeenCalledTimes(1);
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO semesterBandEducator'), ['42', 'Bob', 'Centre 2', 'Supporting Educator']);
    });

    test('14.1.8: settings update failure rolls back and releases', async () => {
        const db = connection();
        const error = new Error('Insert failed');
        pool.getConnection.mockResolvedValue(db);
        db.query
            .mockResolvedValueOnce([[{semesterId: 202601, band: 'A1'}]])
            .mockResolvedValueOnce({}) // ensure semester
            .mockResolvedValueOnce({}) // update Band
            .mockResolvedValueOnce({}) // delete educators
            .mockResolvedValueOnce({}) // insert Alice
            .mockRejectedValueOnce(error); // insert Bob
        await expect(BandModel.updateBandSettings('42', {
            year: 2026, semester: 'Semester 1', description: 'Updated', weights: {},
            educators: [
                {name: 'Alice', centre: 'Centre 1', role: 'Lead Educator'},
                {name: 'Bob', centre: 'Centre 2', role: 'Supporting Educator'}
            ]
        })).rejects.toBe(error);
        expect(db.rollback).toHaveBeenCalledTimes(1);
        expect(db.commit).not.toHaveBeenCalled();
        expect(db.release).toHaveBeenCalledTimes(1);
    });

    test('14.1.12: connection acquisition failure propagates without a transaction', async () => {
        const error = new Error('No connection');
        pool.getConnection.mockRejectedValue(error);
        await expect(BandModel.createBandCohort({name: 'Band A1'})).rejects.toBe(error);
    });

    test('14.1.12: commit failure attempts rollback and releases the connection', async () => {
        const db = connection();
        const error = new Error('Commit failed');
        pool.getConnection.mockResolvedValue(db);
        db.query.mockResolvedValue({});
        db.commit.mockRejectedValue(error);
        await expect(BandModel.createBandCohort({
            name: 'Band A1', year: 2026, semester: 'Semester 1', description: ''
        })).rejects.toBe(error);
        expect(db.rollback).toHaveBeenCalledTimes(1);
        expect(db.release).toHaveBeenCalledTimes(1);
    });

    test('14.1.12: rollback failure is surfaced and the connection is released', async () => {
        const db = connection();
        const insertError = new Error('Insert failed');
        const rollbackError = new Error('Rollback failed');
        pool.getConnection.mockResolvedValue(db);
        db.query.mockResolvedValueOnce({}).mockRejectedValueOnce(insertError);
        db.rollback.mockRejectedValue(rollbackError);
        await expect(BandModel.createBandCohort({
            name: 'Band A1', year: 2026, semester: 'Semester 1', description: ''
        })).rejects.toBe(rollbackError);
        expect(db.commit).not.toHaveBeenCalled();
        expect(db.release).toHaveBeenCalledTimes(1);
    });
});

describe('UC15 Band model enrollment', () => {
    test('supplemental: calculates roster metrics and sorts by surname', () => {
        const result = BandModel.getRoster({
            assessments: [{id: '1', maxPoints: 100, weight: 100}, {id: '2', maxPoints: 100, weight: 0}],
            enrollments: [
                {student: {id: '1', name: 'Bob Tan'}, submissions: {'1': {status: 'GRADED', score: 80, submittedAt: 'x'}}},
                {student: {id: '2', name: 'Alice Lee'}, submissions: {'1': {status: 'SUBMITTED', score: null, submittedAt: 'x'}}}
            ]
        });
        expect(result.map((item) => item.name)).toEqual(['Alice Lee', 'Bob Tan']);
        expect(result[1]).toMatchObject({submissionsPercent: 50, gradedPercent: 50, pendingReview: 0, scorePercent: 80});
        expect(result[0]).toMatchObject({submissionsPercent: 50, gradedPercent: 0, pendingReview: 1, scorePercent: 0});
    });

    test('15.1.9: offers Advance only after a passing prior Band', async () => {
        pool.query.mockResolvedValueOnce([[
            {id: 3, name: 'Cara Lim', centre: 'Centre 1', schoolLevel: 'P6', band: 'B4', semesterBandId: '20',
                academicYear: 2026, semesterNo: 1, assessmentId: 101, assessmentType: 'Quiz', component: 'Reading',
                maxPoints: 100, passingPoints: 50, weight: 100, studentAssessmentId: 501, score: 95}
        ]]);
        await expect(BandModel.getEligibleStudents({
            id: '42', name: 'Band B5', semesterId: 202602, year: 2026, semester: 'Semester 2'
        })).resolves.toEqual([expect.objectContaining({id: '3', latestStatus: 'PASS', movement: 'Advance'})]);
    });

    test('15.1.10: excludes Advance when one rubric fails', async () => {
        pool.query.mockResolvedValueOnce([[
            {id: 3, name: 'Cara Lim', centre: 'Centre 1', schoolLevel: 'P6', band: 'B4', semesterBandId: '20',
                academicYear: 2026, semesterNo: 1, assessmentId: 101, assessmentType: 'Quiz', component: 'Reading',
                maxPoints: 100, passingPoints: 50, weight: 100, studentAssessmentId: 501, score: 49}
        ]]);
        await expect(BandModel.getEligibleStudents({
            id: '42', name: 'Band B5', semesterId: 202602, year: 2026, semester: 'Semester 2'
        })).resolves.toEqual([]);
    });

    test('15.1.15: enrollment insert failure rolls back and rethrows', async () => {
        const db = connection();
        const error = new Error('Insert failed');
        pool.getConnection.mockResolvedValue(db);
        db.query.mockResolvedValueOnce([[{semesterId: 202602, band: 'B5'}]]).mockRejectedValueOnce(error);
        await expect(BandModel.createEnrollment('42', '3', 'Advance')).rejects.toBe(error);
        expect(db.rollback).toHaveBeenCalledTimes(1);
        expect(db.commit).not.toHaveBeenCalled();
        expect(db.release).toHaveBeenCalledTimes(1);
    });

    test('15.1.15: enrollment connection failure starts no transaction', async () => {
        const error = new Error('No connection');
        pool.getConnection.mockRejectedValue(error);
        await expect(BandModel.createEnrollment('42', '3', 'Advance')).rejects.toBe(error);
        expect(pool.query).not.toHaveBeenCalled();
    });
});

describe('UC16 Band model dashboard/history', () => {
    test('16.1.8: missing Band returns null without related queries', async () => {
        pool.query.mockResolvedValueOnce([[]]);
        await expect(BandModel.getBand('999')).resolves.toBeNull();
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('returns earlier Bands newest first as supplied by the ordered query', async () => {
        pool.query.mockResolvedValueOnce([[
            {semesterBandId: '30', band: 'B4', academicYear: 2026, semesterNo: 1},
            {semesterBandId: '20', band: 'A3', academicYear: 2025, semesterNo: 2}
        ]]);
        await expect(BandModel.getPastBands('3', {year: 2026, semester: 'Semester 2'})).resolves.toEqual([
            {studentId: '3', term: '2026 Semester 1', band: 'Band B4', bandId: '30'},
            {studentId: '3', term: '2025 Semester 2', band: 'Band A3', bandId: '20'}
        ]);
    });

    test('16.1.14: history query error propagates', async () => {
        const error = new Error('DB unavailable');
        pool.query.mockRejectedValue(error);
        await expect(BandModel.getPastBands('3', {year: 2026, semester: 'Semester 2'})).rejects.toBe(error);
    });
});
