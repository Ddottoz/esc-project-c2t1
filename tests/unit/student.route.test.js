/**
 * Unit tests for the POST /students route (routes/student.js).
 * Sends real HTTP requests via supertest, with the model layer
 * (models/student.js) mocked — verifies request validation, HTTP
 * status codes/response shape, and correct call sequencing to the model.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../models/student');
const StudentModel = require('../../models/student');
const studentRouter = require('../../routes/student');

const app = express();
app.use(express.json());
app.use('/students', studentRouter);

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
    contactPersons: [
        {
            contactName: 'David Lim',
            phoneNumber: '+65 9182 3456',
            email: 'davidlim@test.com',
            relationship: 'Father',
            isPrimary: true
        },
        {
            contactName: 'Susan Lim',
            phoneNumber: '+65 8123 7890',
            email: 'susanlim@test.com',
            relationship: 'Mother',
            isPrimary: false
        }
    ]
};

afterEach(() => {
    jest.clearAllMocks();
});

// Get Student By ID Unit Test Cases
describe('GET /students/:studentId', () => {
    test('returns 400 when studentId is not a valid number (negative case)', async () => {
        const res = await request(app).get('/students/abc');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalid student id/i);
        expect(StudentModel.getStudentById).not.toHaveBeenCalled();
    });

    test('returns 404 when the student does not exist (negative case)', async () => {
        StudentModel.getStudentById.mockResolvedValue(null);

        const res = await request(app).get('/students/9999');

        expect(StudentModel.getStudentById).toHaveBeenCalledWith(9999);
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/student not found/i);
    });

    test('returns 200 and the student object on success', async () => {
        const payload = {...validPayload};
        StudentModel.getStudentById.mockResolvedValue(payload);

        const res = await request(app).get('/students/5791');

        expect(StudentModel.getStudentById).toHaveBeenCalledWith(5791);
        expect(res.status).toBe(200);
        expect(res.body).toEqual(payload);
    });

    test('returns 500 when the model throws an unexpected error', async () => {
        StudentModel.getStudentById.mockRejectedValue(new Error('DB connection lost'));
        const res = await request(app).get('/students/5791');
        expect(res.status).toBe(500);
    });
});

// Get ALL Students Route Unit Test Cases
describe('GET /students', () => {
    test('returns 200 and an empty array when no students exist (boundary)', async () => {
        StudentModel.getAllStudents.mockResolvedValue([]);

        const res = await request(app).get('/students');

        expect(StudentModel.getAllStudents).toHaveBeenCalled();
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('returns 200 and the full list of students on success', async () => {
        const payload = [
            {...validPayload}, {...validPayload2}
        ];
        StudentModel.getAllStudents.mockResolvedValue(payload);

        const res = await request(app).get('/students');

        expect(StudentModel.getAllStudents).toHaveBeenCalled();
        expect(res.status).toBe(200);
        expect(res.body).toEqual(payload);
    });

    test('returns 500 when the model throws an unexpected error', async () => {
        StudentModel.getAllStudents.mockRejectedValue(new Error('DB connection lost'));
        const res = await request(app).get('/students');
        expect(res.status).toBe(500);
    });
});

// Add Student Route Unit Test Cases
describe('POST /students - form validation', () => {
    test.each([
        'firstName',
        'lastName',
        'nric',
        'dateOfBirth',
        'centreId',
        'educatorId',
        'currentBand',
        'semesterId'
    ])('return 400 when required field "%s" is missing (negative case)', async (field) => {
        const incomplete = {...validPayload};
        delete incomplete[field];

        const res = await request(app).post('/students').send(incomplete);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/required/i);
        expect(StudentModel.nricExists).not.toHaveBeenCalled();
    });

    test('returns 400 on a completely empty payload (negative case)', async () => {
        const res = await request(app).post('/students').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/required/i);
    });
});

describe('POST /students - contact person validation', () => {
    test('returns 400 with 0 contacts (negative case)', async () => {
        const payload = {...validPayload, contactPersons: []};

        const res = await request(app).post('/students').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/at least 1/i);
    });

    test('returns 400 when no contact is marked primary (negative case)', async () => {
        const payload = {...validPayload, contactPersons: [{contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: false}]};

        const res = await request(app).post('/students').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/exactly 1/i);
    });

    test('returns 400 when more than 1 contact is marked primary (boundary)', async () => {
        const payload = {...validPayload, contactPersons: [
            {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true},
            {contactName: 'Ben Tan', phoneNumber: '+65 8256 9583', email: 'bentan@test.com', relationship: 'Father', isPrimary: true}
        ]};

        const res = await request(app).post('/students').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/exactly 1/i);
    });

    test('returns 400 with more than 2 contacts (boundary)', async () => {
        const payload = {...validPayload,
        contactPersons: [
            {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true},
            {contactName: 'Ben Tan', phoneNumber: '+65 8256 9583', email: 'bentan@test.com', relationship: 'Father', isPrimary: false},
            {contactName: 'Evy Tan', phoneNumber: '+65 9259 8112', email: 'evytan@test.com', relationship: 'Sibling', isPrimary: false}
            ]
        };

        const res = await request(app).post('/students').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/maximum of 2/i);
    });

    test('accepts exactly 1 contact marked primary (boundary - lower valid limit)', async () => {
        StudentModel.nricExists.mockResolvedValue(false);
        StudentModel.addStudent.mockResolvedValue(5791);

        const res = await request(app).post('/students').send(validPayload);    // alr has 1 primary contact
        expect(res.status).toBe(201);
    });

    test('accepts exactly 2 contacts with 1 primary (boundary - upper valid limit)', async () => {
        StudentModel.nricExists.mockResolvedValue(false);
        StudentModel.addStudent.mockResolvedValue(5792);

        const payload = {...validPayload,
            contactPersons: [
            {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true},
            {contactName: 'Ben Tan', phoneNumber: '+65 8256 9583', email: 'bentan@test.com', relationship: 'Father', isPrimary: false}
            ]
        };

        const res = await request(app).post('/students').send(payload);
        expect(res.status).toBe(201);
    });
});

describe('POST /students - NRIC uniqueness & creation', () => {
    test('returns 409 when NRIC already exists', async () => {
        StudentModel.nricExists.mockResolvedValue(true);

        const res = await request(app).post('/students').send(validPayload);

        expect(StudentModel.nricExists).toHaveBeenCalledWith('S9876543B');
        expect(StudentModel.addStudent).not.toHaveBeenCalled();
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/already exists/i);
    });

    test('returns 201 and the new studentId on success', async () => {
        StudentModel.nricExists.mockResolvedValue(false);
        StudentModel.addStudent.mockResolvedValue(5791);

        const res = await request(app).post('/students').send(validPayload);
         
        expect(StudentModel.addStudent).toHaveBeenCalledWith(validPayload);
        expect(res.status).toBe(201);
        expect(res.body).toEqual({studentId: 5791});
    });

    test('returns 500 when the model throws an unexpected error', async () => {
        StudentModel.nricExists.mockResolvedValue(false);
        StudentModel.addStudent.mockRejectedValue(new Error('DB connection lost'));
        const res = await request(app).post('/students').send(validPayload);
        expect(res.status).toBe(500);
    });
});

// Edit Student Route Unit Test Cases
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

describe('PUT /students/:studentId - form validation', () => {
    test('returns 400 when studentId is not a valid number (negative case)', async () => {
        const res = await request(app).put('/students/abc').send(validUpdatePayload);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalid student id/i);
        expect(StudentModel.updateStudent).not.toHaveBeenCalled();
    });

    test.each([
        'centreId',
        'educatorId',
        'currentBand',
        'semesterId'
    ])('returns 400 when required field "%s" is missing (negative case)', async (field) => {
        const incomplete = {...validUpdatePayload};
        delete incomplete[field];

        const res = await request(app).put('/students/5791').send(incomplete);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/required/i);
        expect(StudentModel.updateStudent).not.toHaveBeenCalled();
    });
});

describe('PUT /students/:studentId - contact person validation', () => {
    test('returns 400 with 0 contacts (negative case)', async () => {
        const payload = {...validUpdatePayload, contactPersons: []};

        const res = await request(app).put('/students/5791').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/at least 1/i);
    });

    test('returns 400 when no contact is marked primary (negative case)', async () => {
        const payload = {...validUpdatePayload, contactPersons : [{
            contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: false
        }]
        };

        const res = await request(app).put('/students/5791').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/exactly 1/i);
    });

    test('returns 400 when more than 1 contact is marked primary (boundary)', async () => {
        const payload = {...validUpdatePayload,
        contactPersons: [
            {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true},
            {contactName: 'Ben Tan', phoneNumber: '+65 8256 9583', email: 'bentan@test.com', relationship: 'Father', isPrimary: true}
        ]
        };

        const res = await request(app).put('/students/5791').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/exactly 1/i);
    });

    test('returns 400 with more than 2 contacts (boundary)', async () => {
        const payload = {...validUpdatePayload,
            contactPersons: [
                {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true},
                {contactName: 'Ben Tan', phoneNumber: '+65 8256 9583', email: 'bentan@test.com', relationship: 'Father', isPrimary: false},
                {contactName: 'Evy Tan', phoneNumber: '+65 9259 8112', email: 'evytan@test.com', relationship: 'Sibling', isPrimary: false}
            ]
        };

        const res = await request(app).put('/students/5791').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/maximum of 2/i);
    });

    test('accepts exactly 1 contact marked primary (boundary - lower valid limit)', async () => {
        StudentModel.updateStudent.mockResolvedValue(true);

        const res = await request(app).put('/students/5791').send(validUpdatePayload); // alr has 1 primary contact
        expect(res.status).toBe(200);
    });

    test('accepts exactly 2 contacts with 1 primary (boundary - upper valid limit)', async () => {
        StudentModel.updateStudent.mockResolvedValue(true);

        const payload = {...validUpdatePayload,
            contactPersons: [
                {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true},
                {contactName: 'Ben Tan', phoneNumber: '+65 8256 9583', email: 'bentan@test.com', relationship: 'Father', isPrimary: false}
            ]
        };

        const res = await request(app).put('/students/5791').send(payload);
        expect(res.status).toBe(200);
    });
});

describe('PUT /students/:studentId - update outcome', () => {
    test('strips nric from payload on update even if included (immutable field)', async () => {
        StudentModel.updateStudent.mockResolvedValue(true);
        const payload = {...validUpdatePayload, nric: 'S1111111Z'};

        const res = await request(app).put('/students/5791').send(payload);

        // nric MUST NOT be passed through to the model
        expect(StudentModel.updateStudent).toHaveBeenCalledWith(5791, validUpdatePayload);
        expect(res.status).toBe(200);
    });

    test('returns 404 when the student does not exist', async () => {
        StudentModel.updateStudent.mockResolvedValue(false);

        const res = await request(app).put('/students/9999').send(validUpdatePayload);

        expect(StudentModel.updateStudent).toHaveBeenCalledWith(9999, validUpdatePayload);
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/student not found/i);
    });

    test('returns 200 and the studentId on success', async () => {
        StudentModel.updateStudent.mockResolvedValue(true);

        const res = await request(app).put('/students/5791').send(validUpdatePayload);

        expect(StudentModel.updateStudent).toHaveBeenCalledWith(5791, validUpdatePayload);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({studentId: 5791});
    });

    test('returns 500 when the model throws an unexpected error', async () => {
        StudentModel.updateStudent.mockRejectedValue(new Error('DB connection lost'));
        const res = await request(app).put('/students/5791').send(validUpdatePayload);
        expect(res.status).toBe(500);
    });
});

// Delete Student Route Unit Test Cases
describe('DELETE /students/:studentId', () => {
    test('returns 400 when studentId is not a valid number (negative case)', async () => {
        const res = await request(app).delete('/students/abc');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalid student id/i);
        expect(StudentModel.deleteStudent).not.toHaveBeenCalled();
    });

    test('returns 404 when the student does not exist (negative case)', async () => {
        StudentModel.deleteStudent.mockResolvedValue(false);

        const res = await request(app).delete('/students/9999');

        expect(StudentModel.deleteStudent).toHaveBeenCalledWith(9999);
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/student not found/i);
    });

    test('returns 200 on successful deletion', async () => {
        StudentModel.deleteStudent.mockResolvedValue(true);

        const res = await request(app).delete('/students/5791');

        expect(StudentModel.deleteStudent).toHaveBeenCalledWith(5791);
        expect(res.status).toBe(200);
    });

    test('returns 500 when the model throws an unexpected error', async () => {
        StudentModel.deleteStudent.mockRejectedValue(new Error('DB connection lost'));
        const res = await request(app).delete('/students/5791');
        expect(res.status).toBe(500);
    });
});