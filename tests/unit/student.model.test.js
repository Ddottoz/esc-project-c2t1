/**
 * Unit tests for the model layer (models/student.js).
 * Tests nricExists() and addStudent() directly, with the DB pool
 * (models/db.js) mocked — verifies SQL query logic and transaction
 * behavior (commit/rollback/release) without touching a real database.
 */

jest.mock('../../models/db', () => ({
    query: jest.fn(),
    getConnection: jest.fn()
}));

const pool = require('../../models/db');
const StudentModel = require('../../models/student');

afterEach(() => {
    jest.clearAllMocks();
});


// Add Student Model Unit Test Cases
describe('StudentModel.nricExists', () => {
    test('returns true when a student with that NRIC already exists', async () => {
        pool.query.mockResolvedValue([[{studentId: 5}]]);

        const result = await StudentModel.nricExists('S9876543B');

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('SELECT studentId FROM student WHERE nric'), ['S9876543B']
        );
        expect(result).toBe(true);
    });

    test('returns false when no student with that NRIC exists', async () => {
        pool.query.mockResolvedValue([[]]);

        const result = await StudentModel.nricExists('S9999999Z');

        expect(result).toBe(false);
    });
});

describe('StudentModel.addStudent', () => {
    let mockConnection;

    beforeEach(() => {
        mockConnection = {
            beginTransaction: jest.fn().mockResolvedValue(),
            // used for the INSERT into student, recordSemBand & setContactsForStudent calls
            query: jest.fn().mockResolvedValue([{insertId: 5791}]),
            commit: jest.fn().mockResolvedValue(),
            rollback: jest.fn().mockResolvedValue(),
            release: jest.fn()
        };
        pool.getConnection.mockResolvedValue(mockConnection);
    });

    const validPayload = {
        firstName: 'Jane',
        lastName: 'Tan',
        nric: 'S9876543B',
        dateOfBirth: '2015-05-01',
        centreId: 1,
        schoolId: 1,
        educatorId: 1,
        schLevel: 'Secondary',
        currentBand: 'A1',
        semesterId: 202401,
        contactPersons: [{
            contactName: 'Lim Lee Hui',
            phoneNumber: '+65 8121 9216',
            email: 'leehui@test.com',
            relationship: 'Mother',
            isPrimary: true
        }] 
    };

    test('inserts the student and commits the transaction on success', async () => {
        const newId = await StudentModel.addStudent(validPayload);

        expect(mockConnection.beginTransaction).toHaveBeenCalled();
        expect(mockConnection.commit).toHaveBeenCalled();
        expect(mockConnection.rollback).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalled();
        expect(newId).toBe(5791);
    });

    test('rolls back and rethrows if the insert fails (negative case)', async () => {
        mockConnection.query.mockRejectedValueOnce(new Error('DB error'));

        await expect(StudentModel.addStudent(validPayload)).rejects.toThrow('DB error');

        expect(mockConnection.rollback).toHaveBeenCalled();
        expect(mockConnection.commit).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalled();
    });

    test('always releases the connection even when recordSemBand/setContactsForStudent fails', async () => {
        // reject only the query that targets studentSemBand (recordSemBand INSERT) & resolve everyth else
        mockConnection.query.mockImplementation((sql) => {
            if (typeof sql === 'string' && sql.includes('studentSemBand')) {
                return Promise.reject(new Error('semBand insert failed'));
            }
            return Promise.resolve([{insertId: 5791}]);
        });

        await expect(StudentModel.addStudent(validPayload)).rejects.toThrow('semBand insert failed');
        expect(mockConnection.rollback).toHaveBeenCalled();
        expect(mockConnection.commit).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalled();
    });
});

// Edit Student Model Unit Test Cases
describe('StudentModel.updateStudent', () => {
    let mockConnection;

    beforeEach(() => {
        mockConnection = {
            beginTransaction: jest.fn().mockResolvedValue(),
            query: jest.fn().mockResolvedValue([{affectedRows: 1}]),
            commit: jest.fn().mockResolvedValue(),
            rollback: jest.fn().mockResolvedValue(),
            release: jest.fn()
        };
        pool.getConnection.mockResolvedValue(mockConnection);
    });

    const validUpdatePayload = {
        centreId: 1,
        schoolId: 1,
        educatorId: 1,
        schLevel: 'Secondary',
        currentBand: 'A1',
        semesterId: 202401,
        remarks: 'Progressing well',
        contactPersons: [{
            contactName: 'Lim Lee Hui',
            phoneNumber: '+65 8121 9216',
            email: 'leehui@test.com',
            relationship: 'Mother',
            isPrimary: true
        }]
    };

    test('updates the student and commits the transaction on success', async () => {
        const result = await StudentModel.updateStudent(5791, validUpdatePayload);

        expect(mockConnection.beginTransaction).toHaveBeenCalled();
        expect(mockConnection.commit).toHaveBeenCalled();
        expect(mockConnection.rollback).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalled();
        expect(result).toBe(true);
    });

    test('returns false and rolls back without throwing when no matching student exists (boundary - affectedRows 0', async () => {
        mockConnection.query.mockResolvedValueOnce([{affectedRows: 0}]);

        const result = await StudentModel.updateStudent(9999, validUpdatePayload);

        expect(mockConnection.rollback).toHaveBeenCalled();
        expect(mockConnection.commit).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalled();
        expect(result).toBe(false);
    });

    test('rolls back and rethrows if the UPDATE query fails (negative case)', async () => {
        mockConnection.query.mockRejectedValueOnce(new Error('DB error'));

        await expect(StudentModel.updateStudent(5791, validUpdatePayload)).rejects.toThrow('DB error');

        expect(mockConnection.rollback).toHaveBeenCalled();
        expect(mockConnection.commit).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalled();
    });

    test('always releases the connection even when recordSemBand fails', async () => {
        mockConnection.query.mockImplementation((sql) => {
            if (typeof sql === 'string' && sql.includes('studentSemBand')) {
                return Promise.reject(new Error('semBand insert failed'));
            }
            return Promise.resolve([{affectedRows: 1}]);
        });

        await expect(StudentModel.updateStudent(5791, validUpdatePayload)).rejects.toThrow('semBand insert failed');
        expect(mockConnection.rollback).toHaveBeenCalled();
        expect(mockConnection.commit).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalled();
    });
});