/**
 * Unit tests for the frontend AJAX client (javascripts/studentajaxclient.js).
 * Mocks global.fetch — verifies correct URL/method construction, JSON
 * parsing, and error-handling behavior for each wrapper function.
 */

const { json } = require('express');
const {getAllStudents, getStudent, addStudent, updateStudent, deleteStudent} = require('../../public/javascripts/studentajaxclient');

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

beforeEach(() => {
    global.fetch = jest.fn();
});

afterEach(() => {
    jest.clearAllMocks();
});

describe('getAllStudents', () => {
    test('calls the correct endpoint and returns parsed JSON on success', async () => {
        const mockStudents = [{...validPayload, studentId: 5791}];
        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockStudents)
        });

        const result = await getAllStudents();

        expect(global.fetch).toHaveBeenCalledWith('/api/students');
        expect(result).toEqual(mockStudents); 
    });

    test('throws with the backend error message when the response is not ok (negative case)', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            json: jest.fn().mockResolvedValue({error: 'Failed to retrieve students.'})
        });

        await expect(getAllStudents()).rejects.toThrow('Failed to retrieve students.');
    });

    test('falls back to the default message when the error body is not valid JSON (negative case)', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            json: jest.fn().mockRejectedValue(new Error('not JSON'))
        });

        await expect(getAllStudents()).rejects.toThrow('Failed to fetch students.');
    });
});

describe('getStudent', () => {
    test('calls the correct endpoint and returns parsed JSON on success', async () => {
        const mockStudent = {...validPayload, studentId: 5791};
        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockStudent)
        });

        const result = await getStudent(5791);

        expect(global.fetch).toHaveBeenCalledWith('/api/students/5791');
        expect(result).toEqual(mockStudent);
    });

    test('returns null when the response is not ok, eg 404 (negative case)', async () => {
        global.fetch.mockResolvedValue({ok: false, status: 404});

        const result = await getStudent(9999);

        expect(result).toBeNull();
    });
});

describe('addStudent', () => {
    test('calls the correct endpoint with POST method, JSON body and returns parsed JSON on success', async () => {
        const mockResponse = {studentId: 5791};
        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockResponse)
        });

        const result = await addStudent(validPayload);

        expect(global.fetch).toHaveBeenCalledWith('/api/students', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(validPayload)
        });
        expect(result).toEqual(mockResponse);
    });

    test('throws with the backend error message when the response is not ok (negative case)', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            json: jest.fn().mockResolvedValue({error: 'A student with this NRIC already exists.'})
        });

        await expect(addStudent(validPayload)).rejects.toThrow('A student with this NRIC already exists.');
    });

    test('falls back to the default message when the error body is not valid JSON (negative case)', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            json: jest.fn().mockRejectedValue(new Error('not JSON'))
        });

        await expect(addStudent(validPayload)).rejects.toThrow('Failed to add student');
    });
});

describe('updateStudent', () => {
    test('calls the correct endpoint with PUT method, JSON body and returns parsed JSON on success', async () => {
        const mockResponse = {studentId: 5791};
        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockResponse)
        });

        const result = await updateStudent(5791, validUpdatePayload);

        expect(global.fetch).toHaveBeenCalledWith('/api/students/5791', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(validUpdatePayload)
        });
        expect(result).toEqual(mockResponse);
    });

    test('throws with the backend error message when the response is not ok (negative case)', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            json: jest.fn().mockResolvedValue({error: 'Student not found'})
        });

        await expect(updateStudent(9999, validUpdatePayload)).rejects.toThrow('Student not found');
    });

    test('falls back to the default message when the error body is not valid JSON (negative case)', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            json: jest.fn().mockRejectedValue(new Error('not JSON'))
        });

        await expect(updateStudent(5791, validUpdatePayload)).rejects.toThrow('Failed to update student');
    });
});

describe('deleteStudent', () => {
    test('calls the correct endpoint with DELETE method and returns parsed JSON on success', async () => {
        const mockResponse = {studentId: 5791};
        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockResponse)
        });

        const result = await deleteStudent(5791);

        expect(global.fetch).toHaveBeenCalledWith('/api/students/5791', {method: 'DELETE'});
        expect(result).toEqual(mockResponse);
    });

    test('throws with the backend error message when the response is not ok (negative case)', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            json: jest.fn().mockResolvedValue({error: 'Student not found.'})
        });

        await expect(deleteStudent(9999)).rejects.toThrow('Student not found.');
    });

    test('falls back to the default message when the error body is not valid JSON (negative case)', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            json: jest.fn().mockRejectedValue(new Error('not JSON'))
        });

        await expect(deleteStudent(5791)).rejects.toThrow('Failed to delete student.');
    });
});