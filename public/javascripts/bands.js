document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.querySelector('.sidebar-toggle');
    if (sidebar && toggle) {
        toggle.addEventListener('click', () => {
            const collapsed = sidebar.classList.toggle('collapsed');
            document.querySelector('.app-shell').classList.toggle('sidebar-collapsed', collapsed);
            toggle.setAttribute('aria-expanded', String(!collapsed));
            toggle.textContent = collapsed ? '☰' : '‹☰';
        });
    }

    document.querySelectorAll('[data-open-modal]').forEach((button) => button.addEventListener('click', () => {
        document.getElementById(button.dataset.openModal).hidden = false;
    }));
    document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => {
        button.closest('.modal-backdrop').hidden = true;
    }));
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) backdrop.hidden = true;
    }));

    let pendingFormId = null;
    document.querySelectorAll('[data-confirm-form]').forEach((button) => button.addEventListener('click', () => {
        pendingFormId = button.dataset.confirmForm;
        document.getElementById('confirm-modal').hidden = false;
    }));
    document.getElementById('confirm-action')?.addEventListener('click', () => {
        if (pendingFormId) document.getElementById(pendingFormId).submit();
    });

    const rows = Array.from(document.querySelectorAll('#roster-table tbody tr'));
    const search = document.getElementById('roster-search');
    const centre = document.getElementById('centre-filter');
    const level = document.getElementById('level-filter');
    function filterRoster() {
        let visible = 0;
        rows.forEach((row) => {
            const matches = (!search.value || row.dataset.name.includes(search.value.toLowerCase())) &&
                (!centre.value || row.dataset.centre === centre.value) && (!level.value || row.dataset.level === level.value);
            row.hidden = !matches;
            if (matches) visible += 1;
        });
        const empty = document.getElementById('empty-roster');
        if (empty) empty.hidden = visible !== 0;
    }
    [search, centre, level].filter(Boolean).forEach((input) => input.addEventListener('input', filterRoster));
    const sortDirections = {};
    document.querySelectorAll('#roster-table .sort-button').forEach((button) => {
        button.addEventListener('click', () => {
            const key = button.dataset.sort;
            const direction = sortDirections[key] === 'asc' ? 'desc' : 'asc';
            sortDirections[key] = direction;
            const multiplier = direction === 'asc' ? 1 : -1;
            const type = button.dataset.type;
            const body = document.querySelector('#roster-table tbody');

            rows.sort((a, b) => {
                const aValue = a.dataset[key];
                const bValue = b.dataset[key];
                const comparison = type === 'number'
                    ? Number(aValue) - Number(bValue)
                    : aValue.localeCompare(bValue, undefined, {numeric: true});
                // Full name provides a predictable tie-breaker.
                return comparison * multiplier || a.dataset.name.localeCompare(b.dataset.name);
            }).forEach((row) => body.appendChild(row));
        });
    });

    const studentPicker = document.getElementById('student-picker');
    const studentMovement = document.getElementById('student-movement');
    const studentSearch = document.getElementById('student-modal-search');
    const movementFilter = document.getElementById('student-movement-filter');
    function filterAvailableStudents() {
        if (!studentPicker) return;
        let visible = 0;
        Array.from(studentPicker.options).slice(1).forEach((option) => {
            const matches = (!studentSearch.value || option.dataset.name.includes(studentSearch.value.toLowerCase().trim())) &&
                (!movementFilter.value || option.dataset.movement === movementFilter.value);
            option.hidden = !matches;
            option.disabled = !matches;
            if (matches) visible += 1;
        });
        if (studentPicker.selectedOptions[0]?.disabled) studentPicker.value = '';
        document.getElementById('student-filter-empty').hidden = visible !== 0;
    }
    movementFilter?.addEventListener('change', filterAvailableStudents);
    studentPicker?.addEventListener('change', () => {
        // send the movement shown beside the selected student
        if (studentMovement) {
            studentMovement.value = studentPicker.selectedOptions[0]?.dataset.movement || '';
        }
    });
    document.getElementById('student-search-button')?.addEventListener('click', filterAvailableStudents);
    studentSearch?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); filterAvailableStudents(); }
    });

    const educatorRows = document.getElementById('educator-rows');
    document.getElementById('add-educator')?.addEventListener('click', () => {
        educatorRows.appendChild(document.getElementById('educator-template').content.cloneNode(true));
    });
    educatorRows?.addEventListener('click', (event) => {
        if (event.target.closest('.remove-educator')) event.target.closest('.educator-row').remove();
    });

    const dirtyForm = document.querySelector('[data-dirty-form]');
    if (dirtyForm) {
        let dirty = false;
        dirtyForm.addEventListener('input', () => { dirty = true; });
        dirtyForm.addEventListener('submit', () => { dirty = false; });
        window.addEventListener('beforeunload', (event) => {
            if (!dirty) return;
            event.preventDefault();
            event.returnValue = '';
        });
    }
});
