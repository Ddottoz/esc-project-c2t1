const path = require('path');
const ejs = require('ejs');

const template = path.join(__dirname, '../../views/students/dashboard.ejs');
const base = {
    band: {id: '42', name: 'Band B5', year: 2026, semester: 'Semester 2'},
    student: {id: '3', name: 'Cara Lim'}, earned: 92, required: 90,
    resultStatus: 'PASS', passed: true, pastBands: []
};

describe('UC16 dashboard UI', () => {
    test('16.1.1: renders PASS, Review, and history links', async () => {
        const html = await ejs.renderFile(template, {...base,
            assessments: [{id: '101', name: 'Quiz', maxPoints: 50, weight: 100,
                submission: {score: 46, status: 'GRADED', submittedAt: null, studentAssessmentId: '501', hasAnalysis: true}}],
            pastBands: [{bandId: '20', term: '2026 Semester 1', band: 'Band B4', status: 'PASS'}]
        });
        expect(html).toContain('92% weighted score');
        expect(html).toContain('>PASS<');
        expect(html).toContain('/assessments/101/review');
        expect(html).toContain('/bands/20/students/3');
    });

    test('16.1.2: renders safe missing-score fallback and disables Review', async () => {
        const html = await ejs.renderFile(template, {...base, earned: 0, passed: false, resultStatus: 'FAIL',
            assessments: [{id: '101', name: '<Unsafe>', maxPoints: 50, weight: 100,
                submission: {score: null, status: 'MISSING', submittedAt: null, studentAssessmentId: '501', hasAnalysis: false}}]
        });
        expect(html).toContain('--/50');
        expect(html).toContain('&lt;Unsafe&gt;');
        expect(html).toContain('>FAIL<');
        expect(html).toContain('/assessments/101/upload');
        expect(html).not.toContain('/assessments/101/review');
    });
});
