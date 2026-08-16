const request = require('supertest');
const cheerio = require('cheerio'); // Import cheerio
const app = require('../../app'); // Path to your Express app instance

describe('UC7: Generate Progress Report - getStudentReport Integration Tests', () => {

    test('Integration 1.1: Successfully renders progress report page for existing student', async () => {
        const res = await request(app)
            .get('/reports/student/101');

        expect(res.statusCode).toEqual(200);
        expect(res.headers['content-type']).toMatch(/html/);

        // Parse HTML with cheerio
        const $ = cheerio.load(res.text);

        expect($('h2').text()).toContain('Student Performance');
        expect($('.btn-submit').text()).toContain('Confirm and Generate Progress Report');
    });

    test('Integration 1.2: Filters progress report content when startSem and endSem query parameters are supplied', async () => {
        const res = await request(app)
            .get('/reports/student/20?startSem=202501&endSem=202501');

        expect(res.statusCode).toEqual(200);
        expect(res.headers['content-type']).toMatch(/html/);

        // Parse HTML with cheerio
        const $ = cheerio.load(res.text);

        const tableText = $('table').text();

        expect(tableText).toContain('2025 Sem 1');
        expect(tableText).not.toContain('2025 Sem 2');
    });

    test('Integration 1.3: Renders 404 error page when student ID does not exist', async () => {
        const res = await request(app)
            .get('/reports/student/99999');

        expect(res.statusCode).toEqual(404);
        expect(res.headers['content-type']).toMatch(/html/);

        const $ = cheerio.load(res.text);
        expect($('body').text()).toContain('Student report not found');
    });
});
