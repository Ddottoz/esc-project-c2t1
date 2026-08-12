let studentId = null;
let nameEl, bandEl, contentWrap, generateBtn, sidebarBandEl, sidebarNameEl;
let navDashboardEl, navProgressEl, navStudentInfoEl;

// toggles sidebar between expanded/collapsed via .sidebar-collapsed
function setupSidebarToggle() {
    const analysisPage = document.getElementById('analysis-page');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (!analysisPage || !sidebarToggle) return;

    sidebarToggle.addEventListener('click', () => {
        analysisPage.classList.toggle('sidebar-collapsed');
    });
}

// fetch progress data & branch into alt fragment
// render view vs show empty state
async function loadProgress() {
    try {
        const progressData = await getStudentProgress(studentId);

        if (!progressData.semesters || progressData.semesters.length === 0) {
            showEmptyState();
        } else {
            renderProgressView(progressData);
        }
    } catch (err) {
        showStatus(err.message || 'Unable to load progress report.', true);
    }
}

// renders student's name, current band & every sem section
function renderProgressView(data) {
    nameEl.textContent = `${data.firstName} ${data.lastName}`;
    bandEl.textContent = `Current Band: ${data.currentBand}`;

    sidebarBandEl.textContent = `Band ${data.currentBand}`;
    sidebarNameEl.textContent = `${data.firstName} ${data.lastName}`;

    document.querySelectorAll('.term-section').forEach((el) => el.remove());

    data.semesters.forEach((sem) => {
        const section = document.createElement('section');
        section.className = 'term-section';

        const heading = document.createElement('h2');
        heading.textContent = sem.semesterLabel;
        section.appendChild(heading);

        if (!sem.components || sem.components.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = '<p>Band is currently not available yet</p>';
            section.appendChild(empty);
        } else {
            const table = document.createElement('div');
            table.className = 'report-table';
            table.innerHTML = `
                <div class="col-head">Component</div>
                <div class="col-head">Band</div>
                <div class="col-head">Remarks</div>    
            `;
            sem.components.forEach((c) => {
                table.innerHTML += `
                    <div class="cell">${c.componentName}</div>
                    <div class="cell">${c.band}</div>
                    <div class="cell remarks-cell">${c.remarks ?? ''}</div>
                `;
            });
            section.appendChild(table);
        }
        contentWrap.appendChild(section);
    });
}

// show no records empty state
function showEmptyState() {
    document.querySelectorAll('.term-section').forEach((el) => el.remove());
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<p>No progress records available for this student.</p>';
    contentWrap.appendChild(empty);
}

// hands off to UC7 page which renders actual report preview before educator downlaods it
function triggerDownloadReport(id) {
    window.location.href = `/reports/student/${id}`;
}

// shows a status banner at the top of the card (errors, etc.)
function showStatus(message, isError) {
    let statusEl = document.getElementById('statusBanner');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'statusBanner';
        contentWrap.prepend(statusEl);
    }
    statusEl.textContent = message;
    statusEl.className = isError ? 'status-banner status-error' : 'status-banner status-success';
}

// wires up module-lvl DOM references
function wireDomRefs() {
    nameEl = document.getElementById('studentName');
        bandEl = document.getElementById('studentBand');
        sidebarBandEl = document.getElementById('sidebarBand');
        sidebarNameEl = document.getElementById('sidebarStudentName');

        navDashboardEl = document.getElementById('navDashboard');
        navProgressEl = document.getElementById('navProgress');
        navStudentInfoEl = document.getElementById('navStudentInfo');
        navProgressEl.href = `view-progress.html?studentId=${studentId}`;
        navStudentInfoEl.href = `add-edit-student.html?id=${studentId}`;

        contentWrap = document.querySelector('.content-wrap .card');
        generateBtn = document.getElementById('generateBtn');
}

async function init() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        studentId = urlParams.get('studentId');

        wireDomRefs();

        generateBtn.addEventListener('click', () => triggerDownloadReport(studentId));

        setupSidebarToggle();

        await loadProgress(); 
    } catch (err) {
        alert(err.message || 'Failed to initialise progress view.');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {renderProgressView, showEmptyState, wireDomRefs};
} else {
    init();
}