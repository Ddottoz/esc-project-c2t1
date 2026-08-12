let allStudents = [];   // full unfiltered list, loaded once

// helper to escape HTML special characters & prevent XSS injection
// converts dangerous html characters to their html entity equivalents
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

// populates filter dropdown options dynamically based on current student dataset
function populateFilterOptions() {
    // reset select options back to default placeholder before populating
    const resetDropdown = (id, defaultLabel) => {
        const select = document.getElementById(id);
        if (select) select.innerHTML = `<option value="">${defaultLabel}</option>`;
        return select;
    }

    const bandSelect = resetDropdown('filterBand', 'All Bands');
    const centreSelect = resetDropdown('filterCentre', 'All Centres');
    const educatorSelect = resetDropdown('filterEducator', 'All Educators');
    const levelSelect = resetDropdown('filterSchLevel', 'All School Levels');

    // Band filter options
    const bandSet = [...new Set(allStudents.map((s) => s.currentBand).filter(Boolean))].sort();
    bandSet.forEach((b) => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        bandSelect.appendChild(opt);
    });

    // Centre filter options
    const centreSet = new Map();
    allStudents.forEach((s) => {
        if (s.centreId) centreSet.set(s.centreId, s.centreName);
    });
    [...centreSet.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, name]) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = name;
        centreSelect.appendChild(opt);
    });

    // Educator filter options
    const educatorSet = new Map();
    allStudents.forEach((s) => {
        if (s.educatorId) educatorSet.set(s.educatorId, s.educatorName);
    });
    [...educatorSet.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, name]) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = name;
        educatorSelect.appendChild(opt);
    });

    // School level filter options
    const levelSet = [...new Set(allStudents.map((s) => s.schoolLevel).filter(Boolean))].sort();
    levelSet.forEach((lvl) => {
        const opt = document.createElement('option');
        opt.value = lvl;
        opt.textContent = lvl;
        levelSelect.appendChild(opt);
    });
}

// filters student list based on search term & active dropdown criteria
function getFilteredStudents() {
    const band = document.getElementById('filterBand').value;
    const centreId = document.getElementById('filterCentre').value;
    const educatorId = document.getElementById('filterEducator').value;
    const schLevel = document.getElementById('filterSchLevel').value;
    const graduated = document.getElementById('filterGraduated').value;
    const search = document.getElementById('searchBox').value.trim().toLowerCase();

    return allStudents.filter((s) => {
        if (band && s.currentBand !== band) return false;
        if (centreId && String(s.centreId) !== centreId) return false;
        if (educatorId && String(s.educatorId) !== educatorId) return false;
        if (schLevel && s.schoolLevel !== schLevel) return false;
        if (graduated === 'yes' && !s.graduated) return false;
        if (graduated === 'no' && s.graduated) return false;

        if (search) {
            const fullName = `${s.firstName} ${s.lastName}`.toLowerCase(); 
            const nric = (s.nric || '').toLowerCase();
            if (!fullName.includes(search) && !nric.includes(search)) return false;
        }
        return true;
    });
}

// renders student table rows & updates state indicator
function renderRows() {
    const rows = getFilteredStudents();
    const tbody = document.getElementById('studentRows');
    tbody.innerHTML = '';

    document.getElementById('emptyState').style.display = rows.length === 0 ? 'block' : 'none';

    rows.forEach((s) => {
        const tr = document.createElement('tr');
        const fullName = escapeHtml(`${s.firstName || ''} ${s.lastName || ''}`);
        const studentId = encodeURIComponent(s.studentId);
        const studentUrl = s.semesterBandId
            ? `/bands/${encodeURIComponent(s.semesterBandId)}/students/${studentId}`
            : `/add-edit-student.html?id=${studentId}`;

        tr.innerHTML = `
            <td><a href="${studentUrl}">${fullName}</a></td>
            <td>${escapeHtml(s.currentBand)}</td>
            <td>${escapeHtml(s.centreName)}</td>
            <td>${escapeHtml(s.educatorName)}</td>
            <td>${escapeHtml(s.nric)}</td>
            <td>${escapeHtml(s.schoolLevel)}</td>
            <td>${escapeHtml(s.schoolName)}</td>
            <td>${calculateAge(s.dateOfBirth)}</td>
            <td>${formatDate(s.enrollmentDate)}</td>
            <td>${s.graduated ? 'Yes' : 'No'}</td>
            <td class="row-actions">
                <button class="edit-btn" title="Edit" data-id="${s.studentId}">&#9998;</button>
                <button class="delete-btn" title="Delete" data-id="${s.studentId}">&#128465;</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // event delegation setup for dynamic edit & delete btns
    tbody.querySelectorAll('.edit-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            window.location.href = `add-edit-student.html?id=${btn.dataset.id}`;
        });
    });
    tbody.querySelectorAll('.delete-btn').forEach((btn) => {
        btn.addEventListener('click', () => handleDelete(btn.dataset.id));
    });
}

// handles student deletion & UI sync
async function handleDelete(studentId) {
    if (!confirm(`Delete this student? This cannot be undone.`)) return;

    try {
        await deleteStudent(studentId);
        allStudents = allStudents.filter((s) => String(s.studentId) !== String(studentId));
        populateFilterOptions();    // sync filter options if deleted student was the alst representative
        renderRows();
    } catch (err) {
        alert(err.message || 'Failed to delete student.');
    }
}

// exports currently filtered table records as a csv file
function downloadCsv() {
    const rows = getFilteredStudents();
    const header = ['Name', 'Band', 'Centre', 'Educator', 'Student ID', 'School Level', 'School', 'Age', 'Enrollment Date', 'Graduated'];

    const lines = rows.map((s) => [
        `${s.firstName} ${s.lastName}`, s.currentBand || '', s.centreName || '', s.educatorName || '', s.nric, s.schoolLevel || '', s.schoolName || '', calculateAge(s.dateOfBirth), formatDate(s.enrollmentDate), s.graduated ? 'Yes' : 'No'
    ]);

    // format fields with standard RFC 4180 CSV escaping rules
    const formatCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csvContent = [header, ...lines]
        .map((row) => row.map(formatCell).join(','))
        .join('\r\n');

    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a')
    downloadLink.href = url;
    downloadLink.download = 'students.csv';
    downloadLink.click();
    URL.revokeObjectURL(url);
}

async function init() {
    try{
        allStudents = await getAllStudents();
        populateFilterOptions();
        renderRows();

        ['filterBand', 'filterCentre', 'filterEducator', 'filterSchLevel', 'filterGraduated'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', renderRows);
        });

        const searchBox = document.getElementById('searchBox');
        if (searchBox) searchBox.addEventListener('input', renderRows);

        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) downloadBtn.addEventListener('click', downloadCsv);
    } catch (err) {
        alert(err.message || 'Failed to initialise students list');
    }
}

// exports functions for Jest instead of running init() when loaded outside a browser, so the file can be unit tested without crashing on missing browser globals. No effect on real page behavior.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getFilteredStudents, 
        populateFilterOptions,
        __setAllStudentsForTest: (students) => {allStudents = students}};
} else {
    init();
}