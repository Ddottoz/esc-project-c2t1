const semesterBandId = document.body.dataset.semesterBandId;

const semesterId = document.body.dataset.semesterId;

const band = document.body.dataset.band;

async function loadAssessments() {
    try {
        const params = new URLSearchParams();

        document
            .querySelectorAll('.filterInput')
            .forEach(input => {
                if (input.value) {
                    params.set(input.name, input.value);
                }
            });

        const queryString = params.toString();

        let url =
            `/assessments/semBand/${
                encodeURIComponent(semesterBandId)
            }`;

        if (queryString) {
            url += `?${queryString}`;
        }

        const response = await fetch(url, {
            cache: 'no-store'
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                'Failed to fetch assessments'
            );
        }

        renderTable(result.data);
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

// Opens the modal and fills in the read-only assessment info
function openPublishModal(assessmentId, assessments) {
    const assessment = assessments.find(a => a.assessmentId == assessmentId);
    document.getElementById('publishForm').reset();
    document.getElementById('publishAssessmentId').value = assessment.assessmentId;
    document.getElementById('publishAssessmentType').textContent = assessment.assessmentType;
    document.getElementById('publishComponent').textContent = assessment.component;
    document.getElementById('publishBand').textContent = assessment.band;
    document.getElementById('publishMarks').textContent = `${assessment.passingMark} / ${assessment.totalMark}`;

    // document.getElementById('publishForm').reset();
    document.getElementById('publishModal').style.display = 'flex';
}

document.getElementById('cancelPublishBtn').addEventListener('click', () => {
    document.getElementById('publishModal').style.display = 'none';
});

document.getElementById('publishForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const assessmentId = document.getElementById('publishAssessmentId').value;
    const dueDate = document.getElementById('dueDate').value; // format: "YYYY-MM-DD" already

    const response = await fetch(`/assessments/${assessmentId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semesterId, dueDate })
    });

    const result = await response.json();

    if (!response.ok) {
        alert(result.message);
        return;
    }

    alert(`Published! ${result.studentsAssigned} students assigned.`);
    document.getElementById('publishModal').style.display = 'none';
    loadAssessments();
});

// Run once when the page first loads
document.addEventListener('DOMContentLoaded', loadAssessments);

// Run again whenever a filter changes
document.getElementById('filterAssessmentType').addEventListener('change', loadAssessments);
document.getElementById('filterComponent').addEventListener('input', loadAssessments);


function renderTable(assessments) {
    document.getElementById('assessmentCountTitle').textContent = `${assessments.length} Assessments`;
    const tbody = document.getElementById('assessmentTableBody');
    tbody.innerHTML = '';

    if (assessments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10">No assessments found</td></tr>';
        return;
    }

    assessments.forEach(a => {
        const row = document.createElement('tr');
        const submissionUrl = `/submission/${encodeURIComponent(semesterId)}/${encodeURIComponent(band)}/${encodeURIComponent(String(a.assessmentType).replace(/ /g, '_'))}`;

        // Publish / Unpublish cell
        let publishCell;
        if (!a.isPublished) {
            publishCell = `
                <button class="publishBtn" data-id="${a.assessmentId}" type="button">
                    <span>Publish</span>
                </button>
            `;
        } else if (Number(a.totalSubmitted) === 0) {
            // published this semester, but nothing submitted/graded yet -> allow unpublish
            publishCell = `
                <button class="unpublishBtn" data-id="${a.assessmentId}">Unpublish</button>
            `;
        } else {
            // published and has submissions/grades -> locked, no unpublish
            publishCell = `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="#4caf50" d="M320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576zM438 209.7C427.3 201.9 412.3 204.3 404.5 215L285.1 379.2L233 327.1C223.6 317.7 208.4 317.7 199.1 327.1C189.8 336.5 189.7 351.7 199.1 361L271.1 433C276.1 438 282.9 440.5 289.9 440C296.9 439.5 303.3 435.9 307.4 430.2L443.3 243.2C451.1 232.5 448.7 217.5 438 209.7z"/></svg>`;
        }

        // Edit: allowed whenever not published THIS semester (locking of individual fields happens inside the modal)
        const editCell = a.isPublished
            ? ''
            : `<svg width="24" height="24" class="editBtn" data-id="${a.assessmentId}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="#635f5f" d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z"/></svg>`;

        // Delete: only if never published anywhere, ever
        const deleteCell = a.isPublishedAnywhere
            ? ''
            : `<svg width="24" height="24" class="deleteBtn" data-id="${a.assessmentId}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="#635f5f" d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z"/></svg>`;

        const rubricsCell = a.rubrics == null
            ?  '-'
            : `<svg width="24" height="24" class="viewRubricsBtn" data-id="${a.assessmentId}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="#635f5f" d="M320 96C239.2 96 174.5 132.8 127.4 176.6C80.6 220.1 49.3 272 34.4 307.7C31.1 315.6 31.1 324.4 34.4 332.3C49.3 368 80.6 420 127.4 463.4C174.5 507.1 239.2 544 320 544C400.8 544 465.5 507.2 512.6 463.4C559.4 419.9 590.7 368 605.6 332.3C608.9 324.4 608.9 315.6 605.6 307.7C590.7 272 559.4 220 512.6 176.6C465.5 132.9 400.8 96 320 96zM176 320C176 240.5 240.5 176 320 176C399.5 176 464 240.5 464 320C464 399.5 399.5 464 320 464C240.5 464 176 399.5 176 320zM320 256C320 291.3 291.3 320 256 320C244.5 320 233.7 317 224.3 311.6C223.3 322.5 224.2 333.7 227.2 344.8C240.9 396 293.6 426.4 344.8 412.7C396 399 426.4 346.3 412.7 295.1C400.5 249.4 357.2 220.3 311.6 224.3C316.9 233.6 320 244.4 320 256z"/></svg>`
        row.innerHTML = `
            <td><a href="${submissionUrl}">${a.assessmentType}</a></td>
            <td>${a.component}</td>
            <td>${a.totalSubmitted} / ${a.totalAssigned}</td>
            <td>${a.totalGraded} / ${a.totalAssigned}</td>
            <td>${a.passingMark}</td>
            <td>${a.totalMark}</td>
            <td>${a.weight}</td>
            <td>${rubricsCell}</td>
            <td>${publishCell}</td>
            <td>${editCell} ${deleteCell}</td>
        `;
        tbody.appendChild(row);
    });

    document.querySelectorAll('.viewRubricsBtn').forEach(btn => {
        btn.addEventListener('click', () => openRubricsModal(btn.dataset.id, assessments));
    });
    document.querySelectorAll('.editBtn').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id, assessments));
    });
    document.querySelectorAll('.publishBtn').forEach(btn => {
        btn.addEventListener('click', () => openPublishModal(btn.dataset.id, assessments));
    });
    document.querySelectorAll('.deleteBtn').forEach(btn => {
        btn.addEventListener('click', () => handleDelete(btn.dataset.id));
    });
    document.querySelectorAll('.unpublishBtn').forEach(btn => {
        btn.addEventListener('click', () => handleUnpublish(btn.dataset.id));
    });
}

async function handleUnpublish(assessmentId) {
    const confirmed = confirm('Unpublish this assessment for the current semester? Students will lose their assignment.');
    if (!confirmed) return;

    const response = await fetch(`/assessments/${assessmentId}/unpublish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semesterId })
    });

    const result = await response.json();

    if (!response.ok) {
        alert(result.message);
        return;
    }

    alert('Assessment unpublished.');
    loadAssessments();
}

function openEditModal(assessmentId, assessments) {
    const assessment = assessments.find(a => a.assessmentId == assessmentId);

    document.getElementById('assessmentId').value = assessment.assessmentId;
    document.getElementById('assessmentType').value = assessment.assessmentType;
    document.getElementById('component').value = assessment.component;
    document.getElementById('passingMark').value = assessment.passingMark;
    document.getElementById('totalMark').value = assessment.totalMark;
    // shown for reference only, weightage is edited in Band Settings
    document.getElementById('weight').value = assessment.weight ?? 0;
    document.getElementById('rubrics').value = assessment.rubrics;
    document.getElementById('modalTitle').textContent = 'Edit Assessment';

    // Lock core fields if this assessment has ever been published, anywhere.
    // only rubrics stay editable after the assessment has been published
    const lockedFieldIds = ['assessmentType', 'component', 'passingMark', 'totalMark'];
    lockedFieldIds.forEach(id => {
        document.getElementById(id).disabled = !!assessment.isPublishedAnywhere;
    });

    const lockNotice = document.getElementById('editLockNotice'); // add this element to your modal HTML
    if (lockNotice) {
        lockNotice.style.display = assessment.isPublishedAnywhere ? 'block' : 'none';
    }

    document.getElementById('assessmentModal').style.display = 'flex';
}

function openCreateModal() {
    document.getElementById('assessmentForm').reset();
    document.getElementById('assessmentId').value = '';
    document.getElementById('modalTitle').textContent = 'Create Assessment';

    // make sure fields aren't left disabled from a previous edit
    ['assessmentType', 'component', 'passingMark', 'totalMark'].forEach(id => {
        document.getElementById(id).disabled = false;
    });
    const lockNotice = document.getElementById('editLockNotice');
    if (lockNotice) lockNotice.style.display = 'none';

    document.getElementById('assessmentModal').style.display = 'flex';
}

function openRubricsModal(assessmentId, assessments) {
    const assessment = assessments.find(a => a.assessmentId == assessmentId);
    if (!assessment) return;
    document.getElementById('rubricsModalContent').textContent = assessment.rubrics || 'No rubrics available';
    document.getElementById('rubricsModal').style.display = 'flex';
}

document.getElementById('closeRubricsBtn').addEventListener('click', () => {
    document.getElementById('rubricsModal').style.display = 'none';
});

async function handleDelete(assessmentId) {
    const confirmed = confirm('Are you sure you want to delete this assessment? This cannot be undone.');
    if (!confirmed) return;

    const response = await fetch(`/assessments/${assessmentId}`, {
        method: 'DELETE'
    });

    const result = await response.json();

    if (!response.ok) {
        alert(result.message);
        return;
    }

    alert('Assessment deleted.');
    loadAssessments();
}

document.getElementById('addAssessmentBtn').addEventListener('click', openCreateModal);
document.getElementById('cancelModalBtn').addEventListener('click', () => {
    document.getElementById('assessmentModal').style.display = 'none';
});

document.getElementById('assessmentForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // stop the browser's default full-page-reload form submit

    const id = document.getElementById('assessmentId').value;
    const body = {
        assessmentType: document.getElementById('assessmentType').value,
        component: document.getElementById('component').value,
        passingMark: Number(document.getElementById('passingMark').value),
        totalMark: Number(document.getElementById('totalMark').value),
        rubrics: document.getElementById('rubrics').value,
        semesterId: Number(semesterId),
        band: band // from the EJS-injected variable at the top
        
    };

    const isEditing = id !== '';
    const url = isEditing ? `/assessments/${id}` : `/assessments`;
    const method = isEditing ? 'PUT' : 'POST';

    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const result = await response.json();
    alert(result.message);
    if (!response.ok) {
        return;
    }

    document.getElementById('assessmentModal').style.display = 'none';
    loadAssessments(); // refresh the table to show the new/updated row
});

