/**
 * @jest-environment jsdom
 */
 
/**
 * Unit tests for getFilteredStudents() (public/javascripts/students-list.js).
 * This is client-side filtering/search logic that reads the current filter
 * dropdown + search box values from the DOM and filters the already-loaded
 * allStudents array — no backend call involved. Uses a jsdom fixture with
 * plain <input> stand-ins for the filter fields (only .value is read, so
 * the real <select> markup isn't needed for this logic).
 */

const {getFilteredStudents, populateFilterOptions, __setAllStudentsForTest} = require('../../public/javascripts/students-list');

function buildFilterFixture() {
    document.body.innerHTML = `
        <input id="filterBand" value="">
        <input id="filterCentre" value="">
        <input id="filterEducator" value="">
        <input id="filterSchLevel" value="">
        <input id="filterGraduated" value="">
        <input id="searchBox" value="">
    `;
}

const sampleStudents = [
    { studentId: 1, firstName: 'Jane', lastName: 'Tan', nric: 'S9876543B', currentBand: 'A1', centreId: 1, educatorId: 1, schoolLevel: 'Secondary', graduated: false },
    { studentId: 2, firstName: 'John', lastName: 'Lim', nric: 'S1122334C', currentBand: 'B2', centreId: 2, educatorId: 2, schoolLevel: 'Primary', graduated: false },
    { studentId: 3, firstName: 'Amy', lastName: 'Koh', nric: 'S5566778D', currentBand: 'A1', centreId: 1, educatorId: 1, schoolLevel: 'Secondary', graduated: true }
];

beforeEach(() => {
    buildFilterFixture();
    __setAllStudentsForTest(sampleStudents);
});

describe('getFilteredStudents - no filters', () => {
    test('returns all students when every filter and the search box are empty', () => {
        expect(getFilteredStudents()).toEqual(sampleStudents); 
    });
});

describe('getFilteredStudents - dropdown filters', () => {
    test('filters by band', () => {
        document.getElementById('filterBand').value = 'A1';
        const result = getFilteredStudents();
        expect(result.map((s) => s.studentId)).toEqual([1, 3]);
    });

    test('filters by centreId', () => {
        document.getElementById('filterCentre').value = '2';
        const result = getFilteredStudents();
        expect(result.map((s) => s.studentId)).toEqual([2]);
    });

    test('filters by educatorId', () => {
        document.getElementById('filterEducator').value = '1';
        const result = getFilteredStudents();
        expect(result.map((s) => s.studentId)).toEqual([1, 3]);
    });

    test('filters by schoolLevel', () => {
        document.getElementById('filterSchLevel').value = 'Primary';
        const result = getFilteredStudents();
        expect(result.map((s) => s.studentId)).toEqual([2]);
    });

    test('filters to only graduated students when graduated="yes"', () => {
        document.getElementById('filterGraduated').value = 'yes';
        const result = getFilteredStudents();
        expect(result.map((s) => s.studentId)).toEqual([3]);
    });

    test('filters to only non-graduated students when graduated="no"', () => {
        document.getElementById('filterGraduated').value = 'no';
        const result = getFilteredStudents();
        expect(result.map((s) => s.studentId)).toEqual([1, 2]);
    });
});

describe('getFilteredStudents - search box', () => {
    test('matches by partial, case-insensitive name', () => {
        document.getElementById('searchBox').value = 'jane';
        const result = getFilteredStudents();
        expect(result.map((s) => s.studentId)).toEqual([1]);
    });

    test('matches by partial, case-insensitive NRIC', () => {
        document.getElementById('searchBox').value = '1122334';
        const result = getFilteredStudents();
        expect(result.map((s) => s.studentId)).toEqual([2]);
    });

    test('returns an empty array for a search term matching no student (negative case)', () => {
        document.getElementById('searchBox').value = 'NonExistentName';
        expect(getFilteredStudents()).toEqual([]);
    });
});

describe('getFilteredStudents - combined filters', () => {
    test('applied dropdown filter and search term together (AND logic)', () => {
        document.getElementById('filterBand').value = 'A1';
        document.getElementById('searchBox').value = 'amy';
        const result = getFilteredStudents();
        expect(result.map((s) => s.studentId)).toEqual([3]);
    });
});

// populateFilterOptions() builds the actual <option> elements shown in the dropdowns, so it needs real <select> elements — unlike getFilteredStudents, which only ever reads .value and works with plain <input> stand-ins
function buildPopulateOptionsFixture() {
    document.body.innerHTML = `
        <select id="filterBand"></select>
        <select id="filterCentre"></select>
        <select id="filterEducator"></select>
        <select id="filterSchLevel"></select>
    `;
}

// mirrors the real page: shared centre, some students with no assigned educator yet, and a repeated band to prove deduplication
const sampleStudentsForOptions = [
    { studentId: 1, currentBand: 'B6', centreId: 1, centreName: 'Centre L', educatorId: null, educatorName: null, schoolLevel: 'Secondary' },
    { studentId: 2, currentBand: 'C7', centreId: 1, centreName: 'Centre L', educatorId: 5, educatorName: 'Mr Tan', schoolLevel: 'Secondary' },
    { studentId: 3, currentBand: 'B6', centreId: 1, centreName: 'Centre L', educatorId: 5, educatorName: 'Mr Tan', schoolLevel: 'Secondary' },
    { studentId: 4, currentBand: 'C9', centreId: 2, centreName: 'Centre M', educatorId: null, educatorName: null, schoolLevel: 'Primary' }
];

describe('populateFilterOptions', () => {
    beforeEach(() => {
        buildPopulateOptionsFixture();
        __setAllStudentsForTest(sampleStudentsForOptions);
    });

    test('resets each dropdown to its default placeholder option 1st', () => {
        populateFilterOptions();

        expect(document.getElementById('filterBand').options[0].textContent).toBe('All Bands');
        expect(document.getElementById('filterCentre').options[0].textContent).toBe('All Centres');
        expect(document.getElementById('filterEducator').options[0].textContent).toBe('All Educators');
        expect(document.getElementById('filterSchLevel').options[0].textContent).toBe('All School Levels');
    });

    test('populates unique band options, do not duplicate repeated bands', () => {
        populateFilterOptions();

        const bandValues = Array.from(document.getElementById('filterBand').options)
            .slice(1) // skips "All Bands" placeholder
            .map((o) => o.value)
            .sort();

        expect(bandValues).toEqual(['B6', 'C7', 'C9']);
    });

    test('populates unique centre options as id/name pairs', () => {
        populateFilterOptions();

        const centreOptions = Array.from(document.getElementById('filterCentre').options)
            .slice(1) // skips "All Bands" placeholder
            .map((o) => ({value: o.value, label: o.textContent}));

        expect(centreOptions).toEqual(
            expect.arrayContaining([
                {value: '1', label: 'Centre L'},
                {value: '2', label: 'Centre M'}
            ])
        );
        expect(centreOptions).toHaveLength(2); // deduplicated, not 1/student
    });

    test('only lists educators who are actually assigned, skipping students with no educatorId (boundary case)', () => {
        populateFilterOptions();

        const educatorLabels = Array.from(document.getElementById('filterEducator').options)
            .slice(1)
            .map((o) => o.textContent);

        // students 1 & 4 have no educatorId and contribute nothing
        expect(educatorLabels).toEqual(['Mr Tan']);
    });

    test('populates unique school level options', () => {
        populateFilterOptions();

        const levels = Array.from(document.getElementById('filterSchLevel').options)
            .slice(1)
            .map((o) => o.value)
            .sort();

        expect(levels).toEqual(['Primary', 'Secondary']);
    });

    test('does not accumulate duplicate options when called more than once', () => {
        populateFilterOptions();
        populateFilterOptions();

        // default option + 3 unique bands = 4 (not 7)
        expect(document.getElementById('filterBand').options.length).toBe(4);
    });
});