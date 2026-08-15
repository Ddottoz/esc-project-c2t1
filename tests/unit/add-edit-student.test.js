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

const {validateForm, formToStudentObject, collectContactPersons, updateContactCardUI, addContactCard} = require('../../public/javascripts/add-edit-student.js');

// collectContactPersons
function buildContactCardFixture() {
    document.body.innerHTML = `
        <div id="contactPersons"></div>
        <button type="button" id="addContactBtn">+ Add Contact Person</button>
    `;
}

describe('collectContactPersons', () => {
    beforeEach(() => {
        buildContactCardFixture();
    });

    test('reads back contact card values, including a standard relationship', () => {
        addContactCard();
        const card = document.querySelector('.contact-card-item');
        card.querySelector('.contact-name').value = 'Lim Lee Hui';
        card.querySelector('.contact-phone').value = '+65 8121 9216';
        card.querySelector('.contact-email').value = 'leehui@test.com';
        card.querySelector('.contact-relationship-select').value = 'Mother';
        card.querySelector('.contact-primary').checked = true;

        const result = collectContactPersons();

        expect(result).toEqual([{
            contactName: 'Lim Lee Hui',
            phoneNumber: '+65 8121 9216',
            email: 'leehui@test.com',
            relationship: 'Mother',
            isPrimary: true
        }]);
    });

    test('reads relationship from the free-text input when "Other" is selected', () => {
        addContactCard();
        const card = document.querySelector('.contact-card-item');
        card.querySelector('.contact-name').value = 'Ben Tan';
        card.querySelector('.contact-phone').value = '+65 8256 9583';
        card.querySelector('.contact-email').value = 'bentan@test.com';

        const select = card.querySelector('.contact-relationship-select');
        select.value = 'Other';
        select.dispatchEvent(new Event('change'));   // triggers the listener that unhides the free-text input
        card.querySelector('.contact-relationship-other').value = 'Guardian Ad Litem';

        const result = collectContactPersons();

        expect(result[0].relationship).toBe('Guardian Ad Litem');
    });

    test('returns an empty array when there are no contact cards (boundary)', () => {
        expect(collectContactPersons()).toEqual([]);
    });

    test('correctly reflects isPrimary as false for a non-primary contact', () => {
        addContactCard();
        addContactCard();
        const cards = document.querySelectorAll('.contact-card-item');
        cards[0].querySelector('.contact-primary').checked = true;
        cards[1].querySelector('.contact-primary').checked = false;

        const result = collectContactPersons();

        expect(result[0].isPrimary).toBe(true);
        expect(result[1].isPrimary).toBe(false);
    });
})

// formToStudentObject
function buildFullFormFixture() {
    document.body.innerHTML = `
        <input id="firstName" value="Jane">
        <input id="lastName" value="Tan">
        <input id="nric" value="S9876543B">
        <input id="dateOfBirth" value="2015-05-01">
        <select id="schLevel"><option value="Secondary" selected>Secondary</option></select>
        <select id="schoolId"><option value="1" selected>1</option></select>
        <select id="centreId"><option value="1" selected>1</option></select>
        <select id="educatorId"><option value="1" selected>1</option></select>
        <select id="bandLevel"><option value="A1" selected>A1</option></select>
        <select id="semesterId"><option value="202401" selected>202401</option></select>
        <textarea id="remarks"></textarea>
        <div id="contactPersons"></div>
        <button type="button" id="addContactBtn">+ Add Contact Person</button>
    `;
}

describe('formToStudentObject', () => {
    beforeEach(() => {
        buildFullFormFixture();
    });

    test('reads all fields and coerces numeric fields to Number', () => {
        const result = formToStudentObject();

        expect(result.firstName).toBe('Jane');
        expect(result.schoolId).toBe(1);
        expect(result.centreId).toBe(1);
        expect(result.educatorId).toBe(1);
        expect(result.semesterId).toBe(202401);
        expect(typeof result.schoolId).toBe('number');
    });

    test('sets numeric fields to null when their select has no value selected (boundary)', () => {
        document.getElementById('schoolId').innerHTML = '<option value="">Select School</option>';

        const result = formToStudentObject();

        expect(result.schoolId).toBeNull();
    });

    test('trims whitespace from text fields, e.g. remarks', () => {
        document.getElementById('remarks').value = '  doing well  ';

        const result = formToStudentObject();

        expect(result.remarks).toBe('doing well');
    });

    test('returns an empty string for remarks when left blank (boundary)', () => {
        document.getElementById('remarks').value = '';

        const result = formToStudentObject();

        expect(result.remarks).toBe('');
    });

    test('includes contactPersons collected from the contact cards', () => {
        addContactCard();
        const card = document.querySelector('.contact-card-item');
        card.querySelector('.contact-name').value = 'Lim Lee Hui';
        card.querySelector('.contact-phone').value = '+65 8121 9216';
        card.querySelector('.contact-email').value = 'leehui@test.com';
        card.querySelector('.contact-relationship-select').value = 'Mother';
        card.querySelector('.contact-primary').checked = true;

        const result = formToStudentObject();

        expect(result.contactPersons).toHaveLength(1);
        expect(result.contactPersons[0].contactName).toBe('Lim Lee Hui');
    });
});

// addContactCard/updateContactCardUI
describe('addContactCard & updateContactCardUI', () => {
    beforeEach(() => {
        buildContactCardFixture();
    });

    test('adds a contact card to the DOM', () => {
        addContactCard();

        expect(document.querySelectorAll('.contact-card-item')).toHaveLength(1);
    });

    test('does not add a 3rd card once MAX_CONTACTS (2) is reached (boundary)', () => {
        addContactCard();
        addContactCard();
        addContactCard();   // should be a no-op

        expect(document.querySelectorAll('.contact-card-item')).toHaveLength(2);
    });

    test('hides the "Add Contact Person" button once 2 cards are present', () => {
        addContactCard();
        expect(document.getElementById('addContactBtn').classList.contains('hidden')).toBe(false);

        addContactCard();
        expect(document.getElementById('addContactBtn').classList.contains('hidden')).toBe(true);
    });

    test('shows the "Add Contact Person" button again after a card is removed', () => {
        addContactCard();
        addContactCard();
        expect(document.getElementById('addContactBtn').classList.contains('hidden')).toBe(true);

        document.querySelectorAll('.contact-card-item')[1].querySelector('.remove-contact-btn').click();

        expect(document.getElementById('addContactBtn').classList.contains('hidden')).toBe(false);
        expect(document.querySelectorAll('.contact-card-item')).toHaveLength(1);
    });

    test('hides the remove button on the 1st card only', () => {
        addContactCard();
        addContactCard();
        const cards = document.querySelectorAll('.contact-card-item');

        expect(cards[0].querySelector('.remove-contact-btn').style.display).toBe('none');
        expect(cards[1].querySelector('.remove-contact-btn').style.display).toBe('inline-block');
    });

    test('marks the first added card as primary by default', () => {
        addContactCard();
        const card = document.querySelector('.contact-card-item');

        expect(card.querySelector('.contact-primary').checked).toBe(true);
    });

    test('does not mark the second added card as primary by default', () => {
        addContactCard();
        addContactCard();
        const cards = document.querySelectorAll('.contact-card-item');

        expect(cards[1].querySelector('.contact-primary').checked).toBe(false);
    });

    test('pre-fills a card from existing data (edit mode) and respects its isPrimary value', () => {
        addContactCard({
            contactName: 'Existing Contact',
            phoneNumber: '+65 9000 0000',
            email: 'existing@test.com',
            relationship: 'Father',
            isPrimary: false
        });
        const card = document.querySelector('.contact-card-item');

        expect(card.querySelector('.contact-name').value).toBe('Existing Contact');
        expect(card.querySelector('.contact-primary').checked).toBe(false);
    });
});

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

// validateForm — minimal fixture with just the elements validateForm actually touches
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

describe('validateForm - required fields', () => {
    beforeEach(() => {
        buildFormFixture();
    });

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
    beforeEach(() => {
        buildFormFixture();
    });

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

describe('robustness - XSS injection via pre-filled contact data (addContactCard)', () => {
    beforeEach(() => {
        buildContactCardFixture();
    });

    test('a malicious contactName does not break out of the value attribute when pre-filling in edit mode', () => {
        addContactCard({
            contactName: '"><img src=x onerror=alert(1)>',
            phoneNumber: '+65 9000 0000',
            email: 'test@test.com',
            relationship: 'Father',
            isPrimary: false
        });

        const card = document.querySelector('.contact-card-item');
        // if unescaped, this payload would break the attribute and inject a real <img> element as a SIBLING of the input, not inside its value
        expect(card.querySelectorAll('img').length).toBe(0);
        expect(card.querySelector('.contact-name').value).toContain('<img');   // stored safely as literal text in .value, never executed
    });
});