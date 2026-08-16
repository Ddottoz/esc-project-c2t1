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

const validPayload2 = {
    firstName: 'Ben',
    lastName: 'Lim',
    nric: 'T0123456A',
    dateOfBirth: '2013-11-20',
    centreId: 2,
    schoolId: 3,
    educatorId: 2,
    schLevel: 'Primary 6',
    currentBand: 'B2',
    semesterId: 202402,
    contactPersons: [{
        contactName: 'David Lim',
        phoneNumber: '+65 9182 3456',
        email: 'davidlim@test.com',
        relationship: 'Father',
        isPrimary: true
    }]
};

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

// helper: builds a raw DB-shaped contact row (isPrimary as 0/1) from a fixture's contactPersons[0]
function toDbContactRow(payload, contactId, studentId) {
    const c = payload.contactPersons[0];
    return {
        ...(studentId !== undefined ? {studentId} : {}),
        contactId,
        contactName: c.contactName,
        phoneNumber: c.phoneNumber,
        email: c.email,
        relationship: c.relationship,
        isPrimary: c.isPrimary ? 1 : 0   // raw DB value (tinyint)
    };
}

// helper: the same contact shape after the model's Boolean(isPrimary) transform
function toExpectedContact(payload, contactId, studentId) {
    const c = payload.contactPersons[0];
    return {
        ...(studentId !== undefined ? {studentId} : {}),
        contactId,
        contactName: c.contactName,
        phoneNumber: c.phoneNumber,
        email: c.email,
        relationship: c.relationship,
        isPrimary: c.isPrimary
    };
}

afterEach(() => {
    jest.clearAllMocks();
});

// Get Student Model Unit Test Cases
describe('StudentModel.getStudentById', () => {
    test('returns null when no student matches the id (negative case)', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const result = await StudentModel.getStudentById(9999);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('WHERE s.studentId = ?'), [9999]
        );
        expect(result).toBeNull();
    });

    test('returns the student with attached contactPersons on success', async () => {
        const mockStudentRow = {...validPayload, studentId: 5791};
        const mockContacts = [toDbContactRow(validPayload, 1)];

        pool.query
        .mockResolvedValueOnce([[mockStudentRow]]) // main student query
        .mockResolvedValueOnce([mockContacts]); // getContactsForStudent query

        const result = await StudentModel.getStudentById(5791);

        expect(result.studentId).toBe(5791);
        expect(result.contactPersons).toEqual([toExpectedContact(validPayload, 1)]);
    });

    test('rethrows if the query fails (negative case)', async () => {
        pool.query.mockRejectedValueOnce(new Error('DB error'));

        await expect(StudentModel.getStudentById(5791)).rejects.toThrow('DB error');
    });
});

// Get All Students Model Unit Test Cases
describe('StudentModel.getAllStudents', () => {
    test('returns an empty array when no students exist (boundary) and skips the contacts query', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const result = await StudentModel.getAllStudents();

        expect(result).toEqual([]);
        expect(pool.query).toHaveBeenCalledTimes(1); // batch contacts query must be skipped
    });

    test('batches contact persons correctly across multiple students', async () => {
        const mockStudents = [
            {...validPayload, studentId: 5791},
            {...validPayload2, studentId: 5792}
        ];
        const mockContacts = [
            toDbContactRow(validPayload, 1, 5791),
            toDbContactRow(validPayload2, 2, 5792)
        ];

        pool.query
            .mockResolvedValueOnce([mockStudents])
            .mockResolvedValueOnce([mockContacts]);

        const result = await StudentModel.getAllStudents();

        expect(result[0].contactPersons).toEqual([toExpectedContact(validPayload, 1, 5791)]);
        expect(result[1].contactPersons).toEqual([toExpectedContact(validPayload2, 2, 5792)]);
    });

    test('assigns an empty contactPersons array to a student with no contacts (boundary)', async () => {
        const mockStudents = [{...validPayload, studentId: 5791}];
        pool.query
            .mockResolvedValueOnce([mockStudents])
            .mockResolvedValueOnce([[]]); // no matching contacts at all

        const result = await StudentModel.getAllStudents();

        expect(result[0].contactPersons).toEqual([]);
    });

    test('rethrows if the query failed (negative case)', async () => {
        pool.query.mockRejectedValueOnce(new Error('DB error'));

        await expect(StudentModel.getAllStudents()).rejects.toThrow('DB error');
    });
});

// Add Student Model Unit Test Cases
describe('StudentModel.nricExists', () => {
    test('returns true when a student with that NRIC already exists', async () => {
        pool.query.mockResolvedValue([[{studentId: 5}]]);

        const result = await StudentModel.nricExists(validPayload.nric);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('SELECT studentId FROM student WHERE nric'), [validPayload.nric]
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

// Delete Student Model Unit Test Cases
describe('StudentModel.deleteStudent', () => {
    test('returns true when the student is deleted', async () => {
        pool.query.mockResolvedValue([{affectedRows: 1}]);

        const result = await StudentModel.deleteStudent(5791);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM student WHERE studentId'), [5791]
        );
        expect(result).toBe(true);
    });

    test('returns false when no matching student exists (boundary - affectedRows 0)', async () => {
        pool.query.mockResolvedValue([{affectedRows: 0}]);

        const result = await StudentModel.deleteStudent(9999);

        expect(result).toBe(false);
    });

    test('rethrows if the DELETE query fails (negative case)', async () => {
        pool.query.mockRejectedValue(new Error('DB error'));

        await expect(StudentModel.deleteStudent(5791)).rejects.toThrow('DB error');
    });
});

describe('StudentModel.getStudentsByEducator', () => {
    test('returns the list of students for a given educator', async () => {
        const mockStudents = [{...validPayload, studentId: 5791}];
        pool.query.mockResolvedValue([mockStudents]);

        const result = await StudentModel.getStudentsByEducator(2);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('WHERE educatorId = ?'), [2]
        );
        expect(result).toEqual(mockStudents);
    });

    test('returns an empty array when the educator has no students (boundary)', async () => {
        pool.query.mockResolvedValue([[]]);

        const result = await StudentModel.getStudentsByEducator(999);

        expect(result).toEqual([]);
    });

    test('rethrows if the query fails (negative case)', async () => {
        pool.query.mockRejectedValue(new Error('DB error'));

        await expect(StudentModel.getStudentsByEducator(2)).rejects.toThrow('DB error');
    });
});