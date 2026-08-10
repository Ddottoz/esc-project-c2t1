/**
 * @jest-environment jsdom
 */

/**
 * Unit tests for renderProgressView() and showEmptyState()
 * (public/javascripts/view-progress.js).
 * These are client-side rendering functions that build the Progress Report
 * DOM from an already-fetched progress object — uses a jsdom fixture
 * mirroring public/view-progress.html's real element IDs/classes.
 */

const {renderProgressView, showEmptyState, wireDomRefs} = require('../../public/javascripts/view-progress');

function buildProgressFixture() {
    document.body.innerHTML = `
        <h2 id="sidebarBand"></h2>
        <h3 id="sidebarName"></h3>
        <a href="#" id="navDashboard"></a>
        <a href="#" id="navProgress"></a>
        <a href="#" id="navStudentInfo"></a>
        <main class="content-wrap">
            <div class="card">
                <button id="generateBtn"></button>
                <p class="student-name" id="studentName"></p>
                <p class="student-band" id="studentBand"></p>
            </div>
        </main>
    `;
    wireDomRefs();
}

function sampleProgressData() {
    return {
        studentId: 5791,
        firstName: 'Jane',
        lastName: 'Tan',
        currentBand: 'A2',
        semesters: [
            {
                semesterId: 202402,
                semesterLabel: 'AY2024 Sem 2',
                band: 'A2',
                components: [
                    { componentName: 'Comprehension', band: 'A2', remarks: 'Improved fluency' },
                    { componentName: 'Writing', band: 'A2', remarks: null }
                ]
            },
            {
                semesterId: 202401,
                semesterLabel: 'AY2024 Sem 1',
                band: 'A1',
                components: []
            }
        ]
    };
}

beforeEach(() => {
    buildProgressFixture();
});

describe('renderProgressView', () => {
    test('renders student name and current band in the header and side bar', () => {
        renderProgressView(sampleProgressData());

        expect(document.getElementById('studentName').textContent).toBe('Jane Tan');
        expect(document.getElementById('studentBand').textContent).toBe('Current Band: A2');
        expect(document.getElementById('sidebarBand').textContent).toBe('Band A2');
        expect(document.getElementById('sidebarName').textContent).toBe('Jane Tan'); 
    });

    test('renders 1 .term-selection per semester, most recent 1st as given', () => {
        renderProgressView(sampleProgressData());

        const sections = document.querySelectorAll('.term-section');
        expect(sections.length).toBe(2);
        expect(sections[0].querySelector('h2').textContent).toBe('AY2024 Sem 2');
        expect(sections[1].querySelector('h2').textContent).toBe('AY2024 Sem 1');
    });

    test('renders a table row per component with componentName, band and remarks', () => {
        renderProgressView(sampleProgressData());

        const firstSection = document.querySelectorAll('.term-section')[0];
        const cells = firstSection.querySelectorAll('.cell');
        // 2 components x 3 cells each (component, band, remarks)
        expect(cells.length).toBe(6);
        expect(cells[0].textContent).toBe('Comprehension');
        expect(cells[1].textContent).toBe('A2');
        expect(cells[2].textContent).toBe('Improved fluency');
    });

    test('falls back to an empty string for a null remarks value rather than rendering "null"', () => {
        renderProgressView(sampleProgressData());

        const firstSection = document.querySelectorAll('.term-section')[0];
        const remarksCells = firstSection.querySelectorAll('.remarks-cell');
        expect(remarksCells[1].textContent).toBe('');
    });

    test('shows "Band is currently not available yet" for a semester with 0 components (coundary case)', () => {
        renderProgressView(sampleProgressData());

        const secondSection = document.querySelectorAll('.term-section')[1];
        expect(secondSection.querySelector('.empty-state')).not.toBeNull();
        expect(secondSection.textContent).toMatch(/band is currently not available yet/i);
    });

    test('clears previously rendered sections before rendering again (no duplicates on re-render)', () => {
        renderProgressView(sampleProgressData());
        renderProgressView(sampleProgressData());

        expect(document.querySelectorAll('.term-section').length).toBe(2);
    });
});

describe('showEmptyState', () => {
    test('renders the "no progress records" message', () => {
        showEmptyState();

        const emptyDiv = document.querySelector('.empty-state');
        expect(emptyDiv).not.toBeNull();
        expect(emptyDiv.textContent).toMatch(/no progress records available for this student/i);
    });

    test('removes any existing .term-section elements from a previous render', () => {
        renderProgressView(sampleProgressData());
        expect(document.querySelectorAll('.term-section').length).toBe(2);

        showEmptyState();

        expect(document.querySelectorAll('.term-section').length).toBe(0);
    });
});