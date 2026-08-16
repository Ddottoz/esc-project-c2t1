const path = require('path');
const express = require('express');
const request = require('supertest');

jest.mock('../../controllers/BandController', () => ({
    BAND_NAMES: ['Band A1', 'Band A2', 'Band B4', 'Band B5'],
    listBandCohorts: jest.fn(), createBandCohort: jest.fn(), getBandSettings: jest.fn(),
    updateBandSettings: jest.fn(), deleteBandCohort: jest.fn()
}));
jest.mock('../../controllers/EnrollmentController', () => ({
    getRoster: jest.fn(), getEligibleStudents: jest.fn(), addStudent: jest.fn(),
    removeStudent: jest.fn(), exportRosterCsv: jest.fn()
}));
jest.mock('../../controllers/StudentDashboardController', () => ({getDashboard: jest.fn()}));

const bands = require('../../controllers/BandController');
const enrollment = require('../../controllers/EnrollmentController');
const dashboard = require('../../controllers/StudentDashboardController');
const router = require('../../routes/bands');

const band = {id: '42', name: 'Band B5', year: 2026, semester: 'Semester 2', assessments: [
    {id: '101', assessmentType: 'Quiz'}, {id: '102', assessmentType: 'Test'}
]};

function buildApp() {
    const app = express();
    app.set('views', path.join(__dirname, '../../views'));
    app.set('view engine', 'ejs');
    app.use(express.urlencoded({extended: false}));
    app.use('/bands', router);
    app.use((error, req, res, next) => res.status(500).json({message: error.message}));
    return app;
}

beforeEach(() => {
    jest.clearAllMocks();
    bands.getBandSettings.mockResolvedValue(band);
});

describe('UC13 Band routes', () => {
    test('13.1.3: creates and redirects to settings', async () => {
        bands.createBandCohort.mockResolvedValue({id: '42'});
        const response = await request(buildApp()).post('/bands').type('form').send({
            name: 'Band A1', year: '2026', semester: 'Semester 1', description: 'Starter band'
        });
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/bands/42/settings');
        expect(bands.createBandCohort).toHaveBeenCalledWith({
            name: 'Band A1', year: '2026', semester: 'Semester 1', description: 'Starter band'
        });
    });

    test('13.1.4: redirects validation failure with retained values', async () => {
        const error = Object.assign(new Error('Band A1 already exists'), {name: 'ValidationError'});
        bands.createBandCohort.mockRejectedValue(error);
        const response = await request(buildApp()).post('/bands').type('form').send({
            name: 'Band A1', year: '2026', semester: 'Semester 1', description: 'Starter band'
        });
        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('/bands?');
        expect(response.headers.location).toContain('Band+A1+already+exists');
        expect(bands.createBandCohort).toHaveBeenCalledTimes(1);
    });

    test('passes unexpected create errors to middleware', async () => {
        bands.createBandCohort.mockRejectedValue(new Error('DB unavailable'));
        const response = await request(buildApp()).post('/bands').type('form').send({name: 'Band A1'});
        expect(response.status).toBe(500);
        expect(response.body).toEqual({message: 'DB unavailable'});
    });
});

describe('UC14 settings routes', () => {
    test('14.1.3: posts an exact settings draft and redirects', async () => {
        bands.updateBandSettings.mockResolvedValue(band);
        const response = await request(buildApp()).post('/bands/42/settings').type('form').send({
            year: '2026', semester: 'Semester 2', description: 'Updated',
            weight_101: '50', weight_102: '50', educatorName: 'Alice', educatorCentre: 'Centre 1', educatorRole: 'Lead Educator'
        });
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/bands/42/settings?saved=1');
        expect(bands.updateBandSettings).toHaveBeenCalledWith('42', {
            year: '2026', semester: 'Semester 2', description: 'Updated', weights: {'101': 50, '102': 50},
            educators: [{name: 'Alice', centre: 'Centre 1', role: 'Lead Educator'}]
        });
    });

    test('14.1.4: missing Band returns 404 before endpoint', async () => {
        bands.getBandSettings.mockResolvedValue(null);
        const response = await request(buildApp()).get('/bands/999/settings');
        expect(response.status).toBe(404);
        expect(response.text).toContain('Band not found');
        expect(bands.updateBandSettings).not.toHaveBeenCalled();
    });

    test('14.1.9: deletes a Band and redirects', async () => {
        bands.deleteBandCohort.mockResolvedValue(true);
        const response = await request(buildApp()).post('/bands/42/delete');
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/bands');
        expect(bands.deleteBandCohort).toHaveBeenCalledWith('42');
    });
});

describe('UC15 enrollment routes', () => {
    test('15.1.3: adds an eligible student', async () => {
        enrollment.addStudent.mockResolvedValue(true);
        const response = await request(buildApp()).post('/bands/42/enrollment').type('form')
            .send({studentId: '3', movement: 'Advance'});
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/bands/42/enrollment');
        expect(enrollment.addStudent).toHaveBeenCalledWith('42', '3', 'Advance');
    });

    test('15.1.4: redirects an invalid placement', async () => {
        const error = Object.assign(new Error('invalid placement'), {name: 'ValidationError'});
        enrollment.addStudent.mockRejectedValue(error);
        const response = await request(buildApp()).post('/bands/42/enrollment').type('form')
            .send({studentId: '3', movement: 'Advance'});
        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('error=invalid%20placement');
        expect(enrollment.addStudent).toHaveBeenCalledWith('42', '3', 'Advance');
    });

    test('15.1.13: passes a missing student ID to controlled validation', async () => {
        const error = Object.assign(new Error('invalid placement'), {name: 'ValidationError'});
        enrollment.addStudent.mockRejectedValue(error);
        const response = await request(buildApp()).post('/bands/42/enrollment').type('form').send({movement: 'Advance'});
        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('error=invalid%20placement');
        expect(enrollment.addStudent).toHaveBeenCalledWith('42', undefined, 'Advance');
    });

    test('15.1.11: removes a student', async () => {
        enrollment.removeStudent.mockResolvedValue(true);
        const response = await request(buildApp()).post('/bands/42/enrollment/3/delete');
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/bands/42/enrollment');
        expect(enrollment.removeStudent).toHaveBeenCalledWith('42', '3');
    });

    test('15.1.12: exports CSV with attachment headers', async () => {
        enrollment.exportRosterCsv.mockResolvedValue({filename: 'Band B5-enrollment.csv', content: 'Name\r\n"Cara Lim"'});
        const response = await request(buildApp()).get('/bands/42/enrollment.csv');
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/^text\/csv/);
        expect(response.headers['content-disposition']).toContain('Band B5-enrollment.csv');
        expect(response.text).toBe('Name\r\n"Cara Lim"');
    });
});

describe('UC16 dashboard routes', () => {
    test('16.1.3: redirects an analysed assessment to review', async () => {
        dashboard.getDashboard.mockResolvedValue({assessments: [{
            id: '101', submission: {studentAssessmentId: '501', hasAnalysis: true}
        }]});
        const response = await request(buildApp()).get('/bands/42/students/3/assessments/101/review');
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/viewanalysis/501');
    });

    test('16.1.4: returns 404 when review analysis is missing', async () => {
        dashboard.getDashboard.mockResolvedValue({assessments: [{
            id: '101', submission: {studentAssessmentId: '501', hasAnalysis: false}
        }]});
        const response = await request(buildApp()).get('/bands/42/students/3/assessments/101/review');
        expect(response.status).toBe(404);
        expect(response.text).toContain('Assessment analysis not found');
    });

    test('16.1.9: redirects assigned assessment to upload', async () => {
        dashboard.getDashboard.mockResolvedValue({assessments: [{
            id: '101', submission: {studentAssessmentId: '501', hasAnalysis: false}
        }]});
        const response = await request(buildApp()).get('/bands/42/students/3/assessments/101/upload');
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/upload/501');
    });

    test('16.1.10: returns 404 for missing enrollment', async () => {
        dashboard.getDashboard.mockResolvedValue(null);
        const response = await request(buildApp()).get('/bands/42/students/999');
        expect(response.status).toBe(404);
        expect(response.text).toContain('Enrollment not found');
    });
});
