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

afterEach(() => {
    jest.clearAllMocks();
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
    })
})

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
});