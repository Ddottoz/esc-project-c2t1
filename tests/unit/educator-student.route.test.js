/**
 * Unit tests for GET /:educatorId/students (routes/educator-student.js).
 * Sends real HTTP requests via supertest, with the model layer
 * (models/student.js) mocked — verifies input validation, response
 * status/body, and error handling for the educator's student list.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../models/student');
const StudentModel = require('../../models/student');
const educatorStudentRouter = require('../../routes/educator-student');

const app = express();
app.use(express.json());
app.use('/educators', educatorStudentRouter);

afterEach(() => {
    jest.clearAllMocks();
});

describe('GET /educators/:educatorId/students', () => {
    test('returns 400 when educatorId is not a valid number (negative case)', async () => {
        const res = await request(app).get('/educators/abc/students');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalid educator id/i);
        expect(StudentModel.getStudentsByEducator).not.toHaveBeenCalled();
    });

    test('returns 200 with the list of students for a valid educatorId', async () => {
        const mockStudents = [
            {studentId: 1, firstName: 'Jane', lastName: 'Tan', schoolLevel: 'Secondary', currentSemester: 202401, currentBand: 'B4'},
            {studentId: 2, firstName: 'John', lastName: 'Lim', schoolLevel: 'Primary', currentSemester: 202401, currentBand: 'A1'}
        ];
        StudentModel.getStudentsByEducator.mockResolvedValue(mockStudents);

        const res = await request(app).get('/educators/2/students');

        expect(StudentModel.getStudentsByEducator).toHaveBeenCalledWith(2);
        expect(res.status).toBe(200);
        expect(res.body).toEqual(mockStudents);
    });

    test('returns 200 with an empty array when the educator has no students', async () => {
        StudentModel.getStudentsByEducator.mockResolvedValue([]);

        const res = await request(app).get('/educators/2/students');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('returns 200 with an empty array when the model resolves undefined (boundary case)', async () => {
        StudentModel.getStudentsByEducator.mockResolvedValue(undefined);

        const res = await request(app).get('/educators/2/students');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('returns 500 when the model throws (negative case)', async () => {
        StudentModel.getStudentsByEducator.mockRejectedValue(new Error('DB connection lost'));

        const res = await request(app).get('/educators/2/students');

        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/failed to retrieve/i);
    });
});