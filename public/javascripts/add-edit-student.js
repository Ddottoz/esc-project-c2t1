let editingStudentId = null; // null: add mode; a number: edit mode
let contactRowCounter = 0; // gives each dynamically-added contact card a unique radio value

// Standard relationship options for contact person dropdown
// selecting other reveals a free-text box
const RELATIONSHIP_OPTIONS = [
    'Mother',
    'Father',
    'Guardian',
    'Sibling',
    'Grandparent',
    'Other'
];
const MAX_CONTACTS = 2;

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Builds relationship dropdown for 1 contact card (includes free-text field for 'Other')
function buildRelationshipField(rowId, existingRelationship) {
    const isStandard = RELATIONSHIP_OPTIONS.slice(0, -1).includes(existingRelationship);
    const isOther = existingRelationship && !isStandard;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
        <label>Relationship to Student</label>
        <select class="contact-relationship-select">
            <option value="">Select Relationship</option>
            ${RELATIONSHIP_OPTIONS.map((r) => `<option value="${r}" ${r === existingRelationship || (r === 'Other' && isOther) ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
        <input type="text" class="contact-relationship-other ${isOther ? '' : 'hidden'}" placeholder="Please specify" value="${isOther ? existingRelationship : ''}">
    `;

    const select = wrapper.querySelector('.contact-relationship-select');
    const otherInput = wrapper.querySelector('.contact-relationship-other');
    select.addEventListener('change', () => {
        if (select.value === 'Other') {
            otherInput.classList.remove('hidden');
            otherInput.required = true;
        } else {
            otherInput.classList.add('hidden');
            otherInput.required = false;
            otherInput.value = '';
        }
    });
    return wrapper;
}

// caps contact cards at MAX_CONTACTS & manages card removal rules
function updateContactCardUI() {
    const cards = document.querySelectorAll('.contact-card-item');
    const addBtn = document.getElementById('addContactBtn');

    // Hide "+ Add Contact Person" btn if we reach MAX_CONTACTS (2)
    if (addBtn) {
        addBtn.classList.toggle('hidden', cards.length >= MAX_CONTACTS);
    }

    // Hide "Remove" btn on 1st card, show on 2nd card
    cards.forEach((card, index) => {
        const removeBtn = card.querySelector('.remove-contact-btn');
        if (removeBtn) {
            removeBtn.style.display = index === 0 ? 'none' : 'inline-block';
        }
    });
}

// Appends a contact person card to the form container
function addContactCard(data = {}) {
    const existingCards = document.querySelectorAll('.contact-card-item');
    if (existingCards.length >= MAX_CONTACTS) return;
    
    contactRowCounter += 1;
    const rowId = contactRowCounter;

    // Check if this is the first contact card (make it primary by default if new)
    const isFirstCard = existingCards.length === 0;
    const isPrimary = data.isPrimary !== undefined ? data.isPrimary : isFirstCard;

    const card = document.createElement('div');
    card.className = 'contact-card-item';
    card.dataset.rowId = rowId;
    card.innerHTML = `
    <div class="contact-card-header">
        <span class="card-subtitle">Contact Person</span>
        <button type="button" class="remove-btn remove-contact-btn">✕ Remove</button>
    </div>

    <div class="field-grid">
        <div>
            <label>Contact Person's Name</label>
            <input type="text" class="contact-name" placeholder="e.g. John Tan" required value="${escapeHtml(data.contactName || '')}">
        </div>
        <div>
            <label>Contact Person's Phone Number</label>
            <input type="tel" class="contact-phone" placeholder="e.g. +65 9123 4567" required value="${escapeHtml(data.phoneNumber || '')}">
        </div>
        <div>
            <label>Contact Person's Email</label>
            <input type="email" class="contact-email" placeholder="e.g. email@example.com" required value="${escapeHtml(data.email || '')}">
        </div>

            <div class="relationship-field"></div>
        </div>

        <div class="checkbox-row">
            <input type="radio" name="primaryContact" id="primaryContact_${rowId}" class="contact-primary" value="${rowId}" ${isPrimary ? 'checked' : ''}>
            <label for="primaryContact_${rowId}">Mark as primary contact</label>
        </div>
        <div class="field-error"></div>`;

        card.querySelector('.relationship-field').appendChild(buildRelationshipField(rowId, data.relationship));
        card.querySelector('.remove-contact-btn').addEventListener('click', () => {
            card.remove();
            updateContactCardUI();
        });
        document.getElementById('contactPersons').appendChild(card);
        updateContactCardUI();
}

// Extracts current contact card input values into an array of objects
function collectContactPersons() {
    return Array.from(document.querySelectorAll('.contact-card-item')).map((card) => {
        const select = card.querySelector('.contact-relationship-select');
        const otherInput = card.querySelector('.contact-relationship-other');
        const relationship = select.value === 'Other' ? otherInput.value.trim() : select.value;

        return {
            contactName: card.querySelector('.contact-name').value.trim(),
            phoneNumber: card.querySelector('.contact-phone').value.trim(),
            email: card.querySelector('.contact-email').value.trim(),
            relationship,
            isPrimary: card.querySelector('.contact-primary').checked
        };
    });
}

function clearContactCards() {
    document.getElementById('contactPersons').innerHTML = '';
    updateContactCardUI();
}

// Utility: Populates a <select> element using array data
function populateDropdown(selectEl, rows, valueKey, labelKey) {
    selectEl.innerHTML = '<option value="">Select</option>';
    for (const row of rows) {
        const opt = document.createElement('option');
        opt.value = row[valueKey];
        opt.textContent = row[labelKey];
        selectEl.appendChild(opt);
    }
}

async function refreshEducatorDropdown(centreId) {
    const educators = await getEducators(centreId || undefined);
    populateDropdown(document.getElementById('educatorId'), educators, 'educatorId', 'educatorName');
}

async function populateBandDropdown() {
    const bands = await getBands();
    const select = document.getElementById('bandLevel');
    select.innerHTML = '<option value="">Select</option>';
    bands.forEach((b) => {
        const opt = document.createElement('option');
        opt.value = b.band;
        opt.textContent = `Band ${b.band}`;
        select.appendChild(opt);
    });
}

async function populateSemesterDropdown() {
    const semesters = await getSemesters();
    semesters.forEach((s) => (s.semesterLabel = `AY${s.academicYear} Sem ${s.semesterNo}`));
    populateDropdown(document.getElementById('semesterId'), semesters, 'semesterId', 'semesterLabel');
}

// Toggles immutable fields during edit mode
const LOCKED_FIELD_IDS = ['firstName', 'lastName', 'nric', 'dateOfBirth'];

function setLockedFields(isLocked) {
    LOCKED_FIELD_IDS.forEach((id) => {
        const input = document.getElementById(id);
        if (input) {
            input.readOnly = isLocked;
            input.classList.toggle('locked-field', isLocked);
        }
    });
}

function setEditOnlyDisplay(student) {
    if (!student) {
        document.getElementById('ageDisplayWrap').classList.add('hidden');
        document.getElementById('editOnlyInfo').classList.add('hidden');
        return;
    }
    document.getElementById('ageDisplayWrap').classList.remove('hidden');
    document.getElementById('ageDisplay').textContent = calculateAge(student.dateOfBirth);

    document.getElementById('editOnlyInfo').classList.remove('hidden');
    document.getElementById('enrollmentDateDisplay').textContent = formatDate(student.enrollmentDate);
    document.getElementById('educatorNameDisplay').textContent = student.educatorName || '-';
    document.getElementById('educatorCentreDisplay').textContent = student.centreName || '-';
}

// Pre-fills form with existing student's details (for editing)
async function fillFormWithStudent(student) {
    document.getElementById('firstName').value = student.firstName || '';
    document.getElementById('lastName').value = student.lastName || '';
    document.getElementById('nric').value = student.nric || '';
    document.getElementById('dateOfBirth').value = student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '';
    document.getElementById('schLevel').value = student.schoolLevel || '';
    document.getElementById('schoolId').value = student.schoolId || '';
    document.getElementById('centreId').value = student.centreId || '';
    document.getElementById('remarks').value = student.remarks || '';
    document.getElementById('semesterId').value = student.currentSemester || '';
    document.getElementById('bandLevel').value = student.currentBand || '';
    
    await refreshEducatorDropdown(student.centreId);
    document.getElementById('educatorId').value = student.educatorId || '';

    clearContactCards();
    (student.contactPersons || []).forEach((c) => addContactCard(c));

    setLockedFields(true);
    setEditOnlyDisplay(student);
}

// Update title & submit btn based on mode (Add/Edit)
function setMode(isEdit) {
    document.getElementById('pageTitle').textContent = isEdit ? 'Edit Student Information' : 'Add Student';
    document.getElementById('submitBtn').textContent = isEdit ? 'Update Student Information' : 'Add Student';
}

// Show success/error msg under the form
function showStatus(message, isError) {
    const el = document.getElementById('statusMsg');
    el.textContent = message;
    el.className = isError ? 'error' : 'success';
}

// Reads all form input fields into a payload object
function formToStudentObject() {
    return {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        nric: document.getElementById('nric').value.trim(),
        dateOfBirth: document.getElementById('dateOfBirth').value,
        schLevel: document.getElementById('schLevel').value,
        schoolId: document.getElementById('schoolId').value ? Number(document.getElementById('schoolId').value) : null,
        centreId: document.getElementById('centreId').value ? Number(document.getElementById('centreId').value) : null,
        educatorId: document.getElementById('educatorId').value ? Number(document.getElementById('educatorId').value) : null,
        currentBand: document.getElementById('bandLevel').value || null,
        semesterId: document.getElementById('semesterId').value ? Number(document.getElementById('semesterId').value) : null,
        remarks: document.getElementById('remarks').value.trim(),
        contactPersons: collectContactPersons()
    };
}

// Resets error UI states
function clearFieldErrors() {
    document.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
    document.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
}

// Sets error visual states for a specific input field
function markFieldInvalid(inputEl, errorEl, message) {
    if (inputEl) inputEl.classList.add('invalid');
    if (errorEl) errorEl.textContent = message;
}

// Validates required form inputs & primary contact selection
function validateForm(payload) {
    clearFieldErrors();
    let isValid = true;
 
    if (!payload.firstName) {
        markFieldInvalid(document.getElementById('firstName'), document.getElementById('err-firstName'), 'First name is required.');
        isValid = false;
    }
    if (!payload.lastName) {
        markFieldInvalid(document.getElementById('lastName'), document.getElementById('err-lastName'), 'Last name is required.');
        isValid = false;
    }
    if (!payload.nric) {
        markFieldInvalid(document.getElementById('nric'), document.getElementById('err-nric'), 'NRIC is required.');
        isValid = false;
    }
    if (!payload.dateOfBirth) {
        markFieldInvalid(document.getElementById('dateOfBirth'), document.getElementById('err-dateOfBirth'), 'Date of birth is required.');
        isValid = false;
    }
    if (!payload.schLevel) {
        markFieldInvalid(document.getElementById('schLevel'), document.getElementById('err-schLevel'), 'School level is required.');
        isValid = false;
    }
    if (!payload.schoolId) {
        markFieldInvalid(document.getElementById('schoolId'), document.getElementById('err-schoolId'), 'School is required.');
        isValid = false;
    }
    if (!payload.centreId) {
        markFieldInvalid(document.getElementById('centreId'), document.getElementById('err-centreId'), 'Centre is required.');
        isValid = false;
    }
    if (!payload.educatorId) {
        markFieldInvalid(document.getElementById('educatorId'), document.getElementById('err-educatorId'), 'Educator is required.');
        isValid = false;
    }
    if (!payload.currentBand) {
        markFieldInvalid(document.getElementById('bandLevel'), document.getElementById('err-bandLevel'), 'Band is required.');
        isValid = false;
    }
    if (!payload.semesterId) {
        markFieldInvalid(document.getElementById('semesterId'), document.getElementById('err-semesterId'), 'Semester is required.');
        isValid = false;
    }
 
    const contactErrorEl = document.getElementById('err-contactPersons');
    contactErrorEl.textContent = '';
    if (payload.contactPersons.length === 0) {
        contactErrorEl.textContent = 'At least 1 contact person is required.';
        isValid = false;
    } else {
        const primaryCount = payload.contactPersons.filter((c) => c.isPrimary).length;
        if (primaryCount !== 1) {
            contactErrorEl.textContent = 'Exactly 1 contact person must be marked as primary.';
            isValid = false;
        }
    }
 
    return isValid;
}

// Form submit handler (executes validation & API calls)
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
            showStatus(`Saved changes for ${payload.firstName} ${payload.lastName}.`, false);
            setTimeout(() => {
                window.location.href = 'students-list.html'}, 800);
        } else {
            await addStudent(payload);
            showStatus(`Added ${payload.firstName} ${payload.lastName} as a new student.`, false);
            setTimeout(() => {
                window.location.href = 'students-list.html'}, 800);
        }
    } catch (err) {
        // UC4 Alt flow: nric alr exists
        if (err.message && err.message.toLowerCase().includes('already exists')) {
            markFieldInvalid(document.getElementById('nric'), document.getElementById('err-nric'), err.message);
        }
        showStatus(err.message, true);
    }
}

async function handleCentreChange(e) {
    await refreshEducatorDropdown(e.target.value || undefined);
}

// Runs once when page loads (populates dropdown/checkboxes & wires up events)
async function init() {
    populateDropdown(document.getElementById('schoolId'), await getSchools(), 'schoolId', 'schoolName');
    populateDropdown(document.getElementById('centreId'), await getCentres(), 'centreId', 'centreName');
    await refreshEducatorDropdown();
    await populateBandDropdown();
    await populateSemesterDropdown();

    document.getElementById('centreId').addEventListener('change', handleCentreChange);
    document.getElementById('studentForm').addEventListener('submit', handleFormSubmit);
    
    const addContactBtn = document.getElementById('addContactBtn');
    if (addContactBtn) {
        addContactBtn.addEventListener('click', () => addContactCard());
    }

    const params = new URLSearchParams(window.location.search);
    const urlStudentId = params.get('id');
    if (urlStudentId) {
        const student = await getStudent(urlStudentId);
        if (student) {
            editingStudentId = student.studentId;
            setMode(true);
            await fillFormWithStudent(student);
            return;
        }
    }
    setMode(false);
    addContactCard();
}

// Exposes key functions for Jest unit tests (which run in Node, not a browser) without changing browser behavior: `module` only exists under Node/Jest, so in the browser this still just runs init() as normal. In Jest, it exports functions instead of auto-running init(), since init() depends on browser-only globals (document, getSchools, etc.) that don't exist in a test environment and would otherwise crash on load.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateForm,
        formToStudentObject,
        collectContactPersons,
        updateContactCardUI,
        addContactCard,
        escapeHtml,
        calculateAge: typeof calculateAge !== 'undefined' ? calculateAge : undefined
    };
} else {
    init();
}