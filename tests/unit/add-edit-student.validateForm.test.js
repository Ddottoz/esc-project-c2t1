/**
 * @jest-environment jsdom
 */

/**
 * Unit tests for validateForm() (public/javascripts/add-edit-student.js).
 * This is client-side validation that runs before the Add/Edit Student form
 * is submitted — it mutates the DOM directly (adds "invalid" classes, sets
 * error text) rather than returning an error object, so these tests use a
 * jsdom fixture mirroring the real form's element IDs from
 * public/add-edit-student.html.
 */

const {validateForm} = require('../public/javascripts/add-edit-student.js');

// minimal fix with just the elements validateForm actually touches

function buildFormFixture() {
    document.body.innerHTML = `
        <input id="firstName"><div class="field-error" id="err-firstName"></div>
        <input id="lastName"><div class="field-error" id="err-lastName"></div>
        <input id="nric"><div class="field-error" id="err-nric"></div>
        <input id="dateOfBirth"><div class="field-error" id="err-dateOfBirth"></div>
        <select id="schLevel"></select><div class="field-error" id="err-schLevel"></div>
        <select id="schoolId"></select><div class="field-error" id="err-schoolId"></div>
        <div class="field-error" id="err-contactPersons"></div>
        <select id="centreId"></select><div class="field-error" id="err-centreId"></div>
        <select id="educatorId"></select><div class="field-error" id="err-educatorId"></div>
        <select id="bandLevel"></select><div class="field-error" id="err-bandLevel"></div>
        <select id="semesterId"></select><div class="field-error" id="err-semesterId"></div>
    `;
}

function validPayload() {
    return {
        firstName: 'Jane',
        lastName: 'Tan',
        nric: 'S9876543B',
        dateOfBirth: '2015-05-01',
        schLevel: 'Secondary',
        schoolId: 1,
        centreId: 1,
        educatorId: 1,
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
}

beforeEach(() => {
    buildFormFixture();
});

describe('validateForm - required fields', () => {
    test('returns true for a fully valid payload', () => {
        expect(validateForm(validPayload())).toBe(true);
    });

    test.each([
        'firstName', 'lastName', 'nric', 'dateOfBirth', 'schLevel', 'schoolId', 'centreId', 'educatorId', 'currentBand', 'semesterId'
    ])('return false when "%s" is missing (negative case)', (field) => {
        const payload = validPayload();
        payload[field] = '';

        expect(validateForm(payload)).toBe(false);
    });

    test('marks the specific invalid input with the "invalid" class and sets its error text', () => {
        const payload = {...validPayload(), firstName: ''};
        validateForm(payload);

        expect(document.getElementById('firstName').classList.contains('invalid')).toBe(true);
        expect(document.getElementById('err-firstName').textContent).toMatch(/first name is required/i);
    });

    test('marks the "bandLevel" element (not "currentBand") when band is missing - payload key and element id differ', () => {
        const payload = {...validPayload(), currentBand: ''};
        validateForm(payload);

        expect(document.getElementById('bandLevel').classList.contains('invalid')).toBe(true);
        expect(document.getElementById('err-bandLevel').textContent).toMatch(/band is required/i);
    });

    test('clears a previous invalid state on a later valid submission', () => {
        validateForm({...validPayload(), firstName: ''});
        expect(document.getElementById('firstName').classList.contains('invalid')).toBe(true);

        validateForm(validPayload());
        expect(document.getElementById('firstName').classList.contains('invalid')).toBe(false);
        expect(document.getElementById('err-firstName').textContent).toBe('');
    });
});

describe('validateForm - contact person validation', () => {
    test('returns false with "at least 1" message when contactPersons is empty (negative case)', () => {
        const payload = {...validPayload(), contactPersons: []};

        expect(validateForm(payload)).toBe(false);
        expect(document.getElementById('err-contactPersons').textContent).toMatch(/at least 1/i);
    });

    test('returns false when no contact is marked primary (negative case)', () => {
        const payload = {...validPayload(),
            contactPersons: [{
                contactName: 'Lim Lee Hui',
                phoneNumber: '+65 8121 9216',
                email: 'leehui@test.com',
                relationship: 'Mother',
                isPrimary: false}]
        };

        expect(validateForm(payload)).toBe(false);
        expect(document.getElementById('err-contactPersons').textContent).toMatch(/exactly 1/i);
    });

    test('returns false when more than 1 contact is marked primary (boundary)', () => {
        const payload = {...validPayload(),
            contactPersons: [
                {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true},
                {contactName: 'Ben Tan', phoneNumber: '+65 8256 9583', email: 'bentan@test.com', relationship: 'Father', isPrimary: true}
            ]
        };

        expect(validateForm(payload)).toBe(false);
        expect(document.getElementById('err-contactPersons').textContent).toMatch(/exactly 1/i);
    });

    test('accepts exactly 1 contact marked primary (boundary - lower valid limit)', () => {
        expect(validateForm(validPayload())).toBe(true);
    });

    test('accepts exactly 2 contacts with 1 primary (boundary - upper valid limit)', () => {
        const payload = {...validPayload(),
            contactPersons: [
                {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true},
                {contactName: 'Ben Tan', phoneNumber: '+65 8256 9583', email: 'bentan@test.com', relationship: 'Father', isPrimary: false}
            ]
        };

        expect(validateForm(payload)).toBe(true);
    });

    test('does NOT reject more than 2 contacts (frontend has no max-contact check unlike backend)', () => {
        const payload = {...validPayload(),
            contactPersons: [
                {contactName: 'Lim Lee Hui', phoneNumber: '+65 8121 9216', email: 'leehui@test.com', relationship: 'Mother', isPrimary: true},
                {contactName: 'Ben Tan', phoneNumber: '+65 8256 9583', email: 'bentan@test.com', relationship: 'Father', isPrimary: false},
                {contactName: 'Evy Tan', phoneNumber: '+65 9259 8112', email: 'evytan@test.com', relationship: 'Sibling', isPrimary: false}
            ]
        };

        expect(validateForm(payload)).toBe(true);
    });
});