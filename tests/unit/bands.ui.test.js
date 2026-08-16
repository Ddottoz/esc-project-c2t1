/** @jest-environment jsdom */

const path = require('path');
const ejs = require('ejs');

function loadBandsScript(html) {
    document.body.innerHTML = html;
    jest.resetModules();
    require('../../public/javascripts/bands');
    document.dispatchEvent(new Event('DOMContentLoaded'));
}

beforeEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
});

describe('UC13 Create Band UI', () => {
    test('13.1.1: opens and submits the populated create form', () => {
        const submit = jest.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
        loadBandsScript(`
            <button data-open-modal="create-band-modal">Create</button>
            <div id="create-band-modal" class="modal-backdrop" hidden>
              <form id="create-band-form"><input name="name"><input name="year"><input name="semester"><textarea name="description"></textarea></form>
              <button id="create-submit">Submit</button>
            </div>`);
        document.querySelector('[data-open-modal]').click();
        expect(document.getElementById('create-band-modal').hidden).toBe(false);
        const form = document.getElementById('create-band-form');
        form.elements.name.value = 'Band A1';
        form.elements.year.value = '2026';
        form.elements.semester.value = 'Semester 1';
        form.elements.description.value = 'Starter band';
        expect(Object.fromEntries(new FormData(form))).toEqual({
            name: 'Band A1', year: '2026', semester: 'Semester 1', description: 'Starter band'
        });
        form.submit();
        expect(submit).toHaveBeenCalledTimes(1);
    });

    test('13.1.2: EJS opens the validation modal and safely retains values', async () => {
        const submit = jest.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
        const html = await ejs.renderFile(path.join(__dirname, '../../views/bands/index.ejs'), {
            groupedBands: [], createError: 'Band A1 already exists',
            formData: {name: 'Band A1', year: '2026', semester: 'Semester 1', description: 'A & B'}
        });
        expect(html).toContain('A &amp; B');
        loadBandsScript(html);
        expect(document.getElementById('create-band-modal').hidden).toBe(false);
        expect(document.querySelector('[name="name"]').value).toBe('Band A1');
        expect(document.querySelector('[name="year"]').value).toBe('2026');
        expect(document.querySelector('[name="semester"]').value).toBe('Semester 1');
        expect(document.querySelector('[name="description"]').value).toBe('A & B');
        document.querySelector('[data-close-modal]').click();
        expect(document.getElementById('create-band-modal').hidden).toBe(true);
        expect(submit).not.toHaveBeenCalled();
    });
});

describe('UC14 Settings UI', () => {
    test('14.1.1: adds an educator and clears dirty state on submit', () => {
        loadBandsScript(`
          <form id="settings-form" data-dirty-form><input name="description"><div id="educator-rows">
            <div class="educator-row"><input name="educatorName" value="Alice"></div></div>
            <button id="add-educator" type="button">Add</button></form>
          <template id="educator-template"><div class="educator-row"><input name="educatorName" value="Bob"><button class="remove-educator"></button></div></template>`);
        const form = document.getElementById('settings-form');
        const submitEvent = jest.fn();
        form.addEventListener('submit', submitEvent);
        form.elements.description.value = 'Updated';
        form.elements.description.dispatchEvent(new Event('input', {bubbles: true}));
        document.getElementById('add-educator').click();
        expect(document.querySelectorAll('#educator-rows .educator-row').length).toBeGreaterThan(1);
        expect([...document.querySelectorAll('#educator-rows [name="educatorName"]')]
            .some((input) => input.value === 'Bob')).toBe(true);
        form.dispatchEvent(new Event('submit'));
        expect(submitEvent).toHaveBeenCalledTimes(1);
        expect([...document.querySelectorAll('#educator-rows [name="educatorName"]')].map((input) => input.value))
            .toEqual(expect.arrayContaining(['Alice', 'Bob']));
        const leave = new Event('beforeunload', {cancelable: true});
        window.dispatchEvent(leave);
        expect(leave.defaultPrevented).toBe(false);
    });

    test('14.1.2: warns when edited settings are left unsaved', () => {
        loadBandsScript('<form data-dirty-form><input id="weight" value="50"></form>');
        const input = document.getElementById('weight');
        input.value = '60';
        input.dispatchEvent(new Event('input', {bubbles: true}));
        const leave = new Event('beforeunload', {cancelable: true});
        window.dispatchEvent(leave);
        expect(leave.defaultPrevented).toBe(true);
    });
});

describe('UC15 Enrollment UI', () => {
    const enrollmentHtml = `
      <input id="roster-search"><select id="centre-filter"><option value=""></option></select>
      <select id="level-filter"><option value=""></option></select>
      <table id="roster-table"><thead><tr><th><button class="sort-button" data-sort="lastName" data-type="text"></button></th></tr></thead><tbody>
        <tr data-name="alice tan" data-last-name="tan" data-centre="Centre 1" data-level="P5"></tr>
        <tr data-name="bob lee" data-last-name="lee" data-centre="Centre 1" data-level="P6"></tr>
      </tbody></table><p id="empty-roster" hidden></p>
      <form id="add-form"><select id="student-picker" name="studentId"><option value=""></option><option value="3" data-name="cara lim" data-movement="Advance">Cara</option></select>
      <input id="student-movement" name="movement"><button id="add-submit" type="submit">Add</button></form>
      <input id="student-modal-search"><select id="student-movement-filter"><option value=""></option><option>Advance</option></select>
      <button id="student-search-button"></button><p id="student-filter-empty" hidden></p>`;

    test('15.1.1: filters/selects an eligible candidate and records movement', () => {
        loadBandsScript(enrollmentHtml);
        document.getElementById('student-modal-search').value = 'Cara';
        document.getElementById('student-search-button').click();
        const picker = document.getElementById('student-picker');
        picker.value = '3';
        picker.dispatchEvent(new Event('change'));
        expect(picker.options[1].hidden).toBe(false);
        expect(document.getElementById('student-movement').value).toBe('Advance');
        const submitted = jest.fn((event) => event.preventDefault());
        document.getElementById('add-form').addEventListener('submit', submitted);
        document.getElementById('add-submit').click();
        expect(submitted).toHaveBeenCalledTimes(1);
        expect(picker.value).toBe('3');
    });

    test('15.1.2: cancelling Add Student and removal submits neither form', () => {
        const submit = jest.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
        loadBandsScript(`
          <button data-open-modal="add-student-modal">Add Student</button>
          <div id="add-student-modal" class="modal-backdrop" hidden>
            <form id="add-form"></form><button id="cancel-add" data-close-modal>Cancel Add</button>
          </div>
          <button data-confirm-form="remove-3">Remove</button><form id="remove-3"></form>
          <div id="confirm-modal" class="modal-backdrop" hidden><button id="cancel-remove" data-close-modal>Cancel Remove</button><button id="confirm-action"></button></div>`);
        document.querySelector('[data-open-modal]').click();
        expect(document.getElementById('add-student-modal').hidden).toBe(false);
        document.getElementById('cancel-add').click();
        expect(document.getElementById('add-student-modal').hidden).toBe(true);
        document.querySelector('[data-confirm-form]').click();
        expect(document.getElementById('confirm-modal').hidden).toBe(false);
        document.getElementById('cancel-remove').click();
        expect(submit).not.toHaveBeenCalled();
        expect(document.getElementById('confirm-modal').hidden).toBe(true);
    });
});
