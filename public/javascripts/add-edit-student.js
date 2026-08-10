let editingStudentId = null; // null: add mode; a number: edit mode
let contactRowCounter = 0; // gives each dynamically-added contact card a unique radio value

const PROGRAMME_OPTIONS = [
    'Main Literacy Programme',
    'Preschool Programme',
    'PREP 2 PSLE Programme',
    'Maths Programme',
    'Chinese Programme',
    'Science Explorer Programme',
    'Speech And Drama Arts',
    'Speech-Language Therapy',
    'Specialist Teaching',
    'iReaCH',
    'iStudySmart'
];

// Builds 1 checkbox + label per entry in PROGRAMME_OPTIONS
// injects them into 'programmeCheckboxes' container
function renderProgrammeCheckboxes() {
    const container = document.getElementById('programmeCheckboxes');
    container.innerHTML = '';
    PROGRAMME_OPTIONS.forEach((programme, i) => {
        const id = `programme-${i}`;
        const wrapper = document.createElement('div');
        wrapper.className = 'option';
        wrapper.innerHTML = `
            <input type="checkbox" id="${id}" value="${programme}">
            <label for="${id}" style="margin:0;">${programme}</label>
        `;
        container.appendChild(wrapper);
    });
}

// Reads which programme checkboxes are currently ticked
// Used when building the payload to save on form submit
function getCheckedProgrammes() {
    return Array.from(document.querySelectorAll('#programmeCheckboxes input:checked')).map((el) => el.value);
}

// Reads from existing student record & ticks the matching checkboxes
// Used when loading existing student to form
function setCheckedProgrammes(selected = []) {
    document.querySelectorAll('#programmeCheckboxes input').forEach((el) => {
        el.checked = selected.includes(el.value);
    });
}

// Adds one contact person card to the form. Pass existing data when loading
function addContactCard(data = {}) {
    contactRowCounter += 1;
    const rowId = contactRowCounter;

    const card = document.createElement('div');
    card.className = 'contact-card';
    card.dataset.rowId = rowId;
    card.innerHTML = `
        <div class="contact-card-header">
            <span>Contact Person</span>
            <button type="button" class="secondary small remove-contact-btn">Remove</button>
        </div>
        
        <label>Name</label>
        <input type="text" class="contact-name" required value="${data.contactName || ''}">
        
        <label>Phone Number</label>
        <input type="tel" class="contact-phone" required value="${data.phoneNumber || ''}">
 
        <label>Email Address</label>
        <input type="email" class="contact-email" required value="${data.email || ''}">
 
        <label>Relationship to Student</label>
        <input type="text" class="contact-relationship" required value="${data.relationship || ''}">
 
        <div class="checkbox-row">
            <input type="radio" name="primaryContact" class="contact-primary" value="${rowId}" ${data.isPrimary ? 'checked' : ''}>
            <label style="margin:0;">Mark as primary contact</label>
        </div>
        <div class="field-error"></div>`;

        card.querySelector('.remove-contact-btn').addEventListener('click', () => card.remove());
        document.getElementById('contactPersons').appendChild(card);
}

// Reads every contact card currently on the form into an array of plain objects
function collectContactPersons() {
    return Array.from(document.querySelectorAll('.contact-card')).map((card) => ({
        contactName: card.querySelector('.contact-name').value.trim(),
        phoneNumber: card.querySelector('.contact-phone').value.trim(),
        email: card.querySelector('.contact-email').value.trim(),
        relationship: card.querySelector('.contact-relationship').value.trim(),
        isPrimary: card.querySelector('.contact-primary').checked
    }));
}

function clearContactCards() {
    document.getElementById('contactPersons').innerHTML = '';
}

// Fills a <select> with <option> elements from an array of objs
function populateDropdown(selectEl, rows, valueKey, labelKey) {
    selectEl.innerHTML = '<option value="">Select</option>';
    for (const row of rows) {
        const opt = document.createElement('option');
        opt.value = row[valueKey];
        opt.textContent = row[labelKey];
        selectEl.appendChild(opt);
    }
}

// Fills "editing an existing student" dropdown with every student
// Re-runs after adding a new student
async function populateExistingStudentPicker() {
    const students = await getAllStudents();
    const picker = document.getElementById('existingStudentPicker');
    picker.innerHTML = '<option value="">-- Add a new student instead --</option>';
    for (const s of students) {
        const opt = document.createElement('option');
        opt.value = s.studentId;
        opt.textContent = `${s.studentName} (ID ${s.studentId})`;
        picker.appendChild(opt);
    }
}

// Pre-fills form with existing student's data (for editing)
function fillFormWithStudent(student) {
    document.getElementById('studentId').value = student.studentId || '';
    document.getElementById('studentId').disabled = true; // ID is PK (dun allow editing)
    document.getElementById('studentName').value = student.studentName || '';
    document.getElementById('dateOfBirth').value = student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '';
    document.getElementById('phoneNumber').value = student.phoneNumber || '';
    document.getElementById('email').value = student.email || '';
    document.getElementById('schLevel').value = student.schLevel || '';
    document.getElementById('schoolId').value = student.schoolId || '';
    document.getElementById('centreId').value = student.centreId || '';
    document.getElementById('teacherId').value = student.teacherId || '';
    
    setCheckedProgrammes(student.programmesAttending || []);

    clearContactCards();
    (student.contactPersons || []).forEach((c) => addContactCard(c));
}

// Resets form to blank
function clearForm() {
    document.getElementById('studentForm').reset();
    document.getElementById('studentId').disabled = false;
    clearContactCards();
}

// Swaps form heading/btn between add & edit mode
function setMode(isEdit) {
    document.getElementById('formTitle').textContent = isEdit ? 'Edit Student' : 'Create Student';
    document.getElementById('submitBtn').textContent = isEdit ? 'Save Changes' : 'Create Student';
}

// Show success/error msg under the form
function showStatus(message, isError) {
    const el = document.getElementById('statusMsg');
    el.textContent = message;
    el.className = isError ? 'error' : 'success';
}

// Reads the form fields into a plain obj matching a student record
function formToStudentObject() {
    return {
        studentId: document.getElementById('studentId').value.trim(),
        studentName: document.getElementById('studentName').value.trim(),
        dateOfBirth: document.getElementById('dateOfBirth').value,
        phoneNumber: document.getElementById('phoneNumber').value.trim(),
        email: document.getElementById('email').value.trim(),
        schLevel: document.getElementById('schLevel').value,
        schoolId: document.getElementById('schoolId').value ? Number(document.getElementById('schoolId').value) : null,
        centreId: document.getElementById('centreId').value ? Number(document.getElementById('centreId').value) : null,
        teacherId: document.getElementById('teacherId').value ? Number(document.getElementById('teacherId').value) : null,
        programmesAttending: getCheckedProgrammes(),
        contactPersons: collectContactPersons()
    };
}

// Removes all invalid field highlighting & error msg from prev validation
function clearFieldErrors() {
    document.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
    document.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
}

// Highlights 1 field red & shows a msg under it
function markFieldInvalid(inputEl, errorEl, message) {
    inputEl.classList.add('invalid');
    if (errorEl) errorEl.textContent = message;
}

// Checks all required fields + at most 1 primary contact
// Highlights any problems & returns true/false
function validateForm(payload) {
    clearFieldErrors();
    let isValid = true;
 
    if (!payload.studentId) {
        markFieldInvalid(document.getElementById('studentId'), document.getElementById('err-studentId'), 'Student ID is required.');
        isValid = false;
    }
    if (!payload.studentName) {
        markFieldInvalid(document.getElementById('studentName'), document.getElementById('err-studentName'), 'Student name is required.');
        isValid = false;
    }
    if (!payload.dateOfBirth) {
        markFieldInvalid(document.getElementById('dateOfBirth'), document.getElementById('err-dateOfBirth'), 'Date of birth is required.');
        isValid = false;
    }
    if (!payload.centreId) {
        markFieldInvalid(document.getElementById('centreId'), document.getElementById('err-centreId'), 'Centre is required.');
        isValid = false;
    }
    if (!payload.teacherId) {
        markFieldInvalid(document.getElementById('teacherId'), document.getElementById('err-teacherId'), 'Teacher is required.');
        isValid = false;
    }
 
    const primaryCount = payload.contactPersons.filter((c) => c.isPrimary).length;
    if (primaryCount > 1) {
        showStatus('Only one contact person can be marked as primary.', true);
        isValid = false;
    }
 
    return isValid;
}

// Runs when a student is picked from existing-student dropdown
// Empty selection => add mode 
async function handleExistingStudentChange(e) {
    const id = e.target.value;
    if (!id) {
        editingStudentId = null;
        setMode(false);
        clearForm();
        showStatus('', false);
        return;
    }
    const student = await getStudent(id);
    if (!student) return;
    editingStudentId = student.studentId;
    setMode(true);
    fillFormWithStudent(student);
    showStatus('', false);
}

// Runs on form submit (validates required fields then adds/updates)
async function handleFormSubmit(e) {
    e.preventDefault();
    const payload = formToStudentObject();

    if (!validateForm(payload)) {
        showStatus('Please fix the highlighted fields.', true);
        return;
    }

    try {
        if (editingStudentId) {
            await updateStudent(editingStudentId, payload);
            showStatus(`Saved changes for ${payload.studentName}.`, false);
        } else {
            await addStudent(payload);
            showStatus(`Added ${payload.studentName} as a new student.`, false);
            await populateExistingStudentPicker();
            clearForm();
        }
    } catch (err) {
        // UC4 Alt flow: student ID alr exists
        if (err.message && err.message.toLowerCase().includes('already exists')) {
            markFieldInvalid(document.getElementById('studentId'), document.getElementById('err-studentId'), err.message);
        }
        showStatus(err.message, true);
    }
}

// Runs once when page loads (populates dropdown/checkboxes & wires up events)
async function init() {
    populateDropdown(document.getElementById('schoolId'), await getSchools(), 'schoolId', 'schoolName');
    populateDropdown(document.getElementById('centreId'), await getCentres(), 'centreId', 'centreName');
    populateDropdown(document.getElementById('teacherId'), await getTeachers(), 'teacherId', 'teacherName');
    await populateExistingStudentPicker();
    renderProgrammeCheckboxes();

    document.getElementById('existingStudentPicker').addEventListener('change', handleExistingStudentChange);
    document.getElementById('studentForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('addContactBtn').addEventListener('click', () => addContactCard());
}

init();