/**
 * @jest-environment jsdom
 */

function mockResponse(body, ok = true) {
    return Promise.resolve({
        ok,
        json: jest.fn().mockResolvedValue(body)
    });
}

function flushPromises() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function fire(element, eventType) {
    element.dispatchEvent(
        new Event(eventType, {
            bubbles: true,
            cancelable: true
        })
    );
}

function createDOM() {
    document.body.innerHTML = `
        <h1 id="assessmentCountTitle"></h1>

        <select
            class="filterInput"
            id="filterAssessmentType"
            name="assessmentType"
        >
            <option value="">All Types</option>
            <option value="Letter Formation">Letter Formation</option>
            <option value="Fluency">Fluency</option>
            <option value="Comprehension">Comprehension</option>
        </select>

        <select
            class="filterInput"
            id="filterComponent"
            name="component"
        >
            <option value="">All Components</option>
            <option value="Vocabulary">Vocabulary</option>
            <option value="Writing">Writing</option>
        </select>

        <table>
            <tbody id="assessmentTableBody"></tbody>
        </table>

        <button id="addAssessmentBtn" type="button">
            Create Assessment
        </button>

        <div id="assessmentModal" style="display: none;">
            <h2 id="modalTitle"></h2>

            <p id="editLockNotice" style="display: none;"></p>

            <form id="assessmentForm">
                <input id="assessmentId" type="hidden">

                <select id="assessmentType">
                    <option value=""></option>
                    <option value="Letter Formation">
                        Letter Formation
                    </option>
                    <option value="Fluency">Fluency</option>
                    <option value="Comprehension">
                        Comprehension
                    </option>
                </select>

                <select id="component">
                    <option value=""></option>
                    <option value="Vocabulary">
                        Vocabulary
                    </option>
                    <option value="Writing">Writing</option>
                </select>

                <input id="passingMark" type="number">
                <input id="totalMark" type="number">

                <input
                    id="weight"
                    type="number"
                    value="0"
                    disabled
                >

                <textarea id="rubrics"></textarea>

                <button id="cancelModalBtn" type="button">
                    Cancel
                </button>

                <button type="submit">Save</button>
            </form>
        </div>

        <div id="publishModal" style="display: none;">
            <span id="publishAssessmentType"></span>
            <span id="publishComponent"></span>
            <span id="publishBand"></span>
            <span id="publishMarks"></span>

            <form id="publishForm">
                <input id="publishAssessmentId" type="hidden">
                <input id="dueDate" type="date">

                <button id="cancelPublishBtn" type="button">
                    Cancel
                </button>

                <button type="submit">Publish</button>
            </form>
        </div>

        <div id="rubricsModal" style="display: none;">
            <p id="rubricsModalContent"></p>

            <button id="closeRubricsBtn" type="button">
                Close
            </button>
        </div>
    `;

    document.body.dataset.semesterBandId =
        'band-a1-2022-s1';

    document.body.dataset.semesterId = '202201';
    document.body.dataset.band = 'A1';
}

function assessment(overrides = {}) {
    return {
        assessmentId: 15,
        assessmentType: 'Fluency',
        component: 'Vocabulary',
        band: 'A1',
        passingMark: 50,
        totalMark: 100,
        weight: 0,
        rubrics: 'Read each word clearly.',
        totalAssigned: 24,
        totalSubmitted: 0,
        totalGraded: 0,
        isPublished: false,
        isPublishedAnywhere: false,
        ...overrides
    };
}

function fillAssessmentForm(overrides = {}) {
    const values = {
        id: '',
        assessmentType: 'Fluency',
        component: 'Vocabulary',
        passingMark: '50',
        totalMark: '100',
        weight: '0',
        rubrics: 'Read each word clearly.',
        ...overrides
    };

    document.getElementById('assessmentId').value =
        values.id;

    document.getElementById('assessmentType').value =
        values.assessmentType;

    document.getElementById('component').value =
        values.component;

    document.getElementById('passingMark').value =
        values.passingMark;

    document.getElementById('totalMark').value =
        values.totalMark;

    document.getElementById('weight').value =
        values.weight;

    document.getElementById('rubrics').value =
        values.rubrics;
}

async function renderAssessments(rows) {
    fetch.mockImplementationOnce(() =>
        mockResponse({ data: rows })
    );

    fire(
        document.getElementById('filterAssessmentType'),
        'change'
    );

    await flushPromises();

    fetch.mockClear();
}

describe('Assessment UI', () => {
    beforeEach(() => {
        jest.resetModules();
        createDOM();

        global.fetch = jest.fn();
        global.alert = jest.fn();
        global.confirm = jest.fn();

        jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        require('../../public/javascripts/assessmentList');
    });

    afterEach(() => {
        jest.restoreAllMocks();

        delete global.fetch;
        delete global.alert;
        delete global.confirm;
    });

    describe('Create Assessment', () => {
        test('opens an empty enabled creation form', () => {
            fillAssessmentForm({
                id: '15',
                weight: '75'
            });

            document.getElementById(
                'assessmentType'
            ).disabled = true;

            document.getElementById(
                'component'
            ).disabled = true;

            document.getElementById(
                'passingMark'
            ).disabled = true;

            document.getElementById(
                'totalMark'
            ).disabled = true;

            document.getElementById(
                'editLockNotice'
            ).style.display = 'block';

            document.getElementById(
                'addAssessmentBtn'
            ).click();

            expect(
                document.getElementById(
                    'assessmentId'
                ).value
            ).toBe('');

            expect(
                document.getElementById(
                    'modalTitle'
                ).textContent
            ).toBe('Create Assessment');

            for (const id of [
                'assessmentType',
                'component',
                'passingMark',
                'totalMark'
            ]) {
                expect(
                    document.getElementById(id).disabled
                ).toBe(false);
            }

            expect(
                document.getElementById('weight').disabled
            ).toBe(true);

            expect(
                document.getElementById(
                    'editLockNotice'
                ).style.display
            ).toBe('none');

            expect(
                document.getElementById(
                    'assessmentModal'
                ).style.display
            ).toBe('flex');
        });

        test('submits minimum marks as numbers without weight', async () => {
            fetch
                .mockImplementationOnce(() =>
                    mockResponse({
                        message:
                            'Assessment created successfully',
                        assessmentId: 11
                    })
                )
                .mockImplementationOnce(() =>
                    mockResponse({ data: [] })
                );

            fillAssessmentForm({
                assessmentType: 'Letter Formation',
                component: 'Writing',
                passingMark: '0',
                totalMark: '0',
                weight: '75',
                rubrics: ''
            });

            document.getElementById(
                'assessmentModal'
            ).style.display = 'flex';

            fire(
                document.getElementById('assessmentForm'),
                'submit'
            );

            await flushPromises();

            const [url, options] = fetch.mock.calls[0];
            const body = JSON.parse(options.body);

            expect(url).toBe('/assessments');
            expect(options.method).toBe('POST');

            expect(body).toEqual({
                assessmentType: 'Letter Formation',
                component: 'Writing',
                passingMark: 0,
                totalMark: 0,
                rubrics: '',
                semesterId: 202201,
                band: 'A1'
            });

            expect(body).not.toHaveProperty('weight');

            expect(alert).toHaveBeenCalledWith(
                'Assessment created successfully'
            );

            expect(
                document.getElementById(
                    'assessmentModal'
                ).style.display
            ).toBe('none');

            expect(fetch).toHaveBeenCalledTimes(2);
        });

        test.each([
            [
                'Assessment type already exists for this band'
            ],
            [
                'Passing Mark cannot exceed Total Mark'
            ],
            [
                'passingMark cannot be negative'
            ],
            [
                'No matching band found for this semester'
            ],
            [
                'Failed to create assessment'
            ]
        ])(
            'keeps modal open when creation fails: %s',
            async message => {
                fetch.mockImplementationOnce(() =>
                    mockResponse(
                        { message },
                        false
                    )
                );

                fillAssessmentForm();

                document.getElementById(
                    'assessmentModal'
                ).style.display = 'flex';

                fire(
                    document.getElementById(
                        'assessmentForm'
                    ),
                    'submit'
                );

                await flushPromises();

                expect(alert).toHaveBeenCalledWith(
                    message
                );

                expect(
                    document.getElementById(
                        'assessmentModal'
                    ).style.display
                ).toBe('flex');

                expect(fetch).toHaveBeenCalledTimes(1);
            }
        );
    });

    describe('Edit Assessment', () => {
        test('opens an unpublished assessment with editable core fields', async () => {
            await renderAssessments([
                assessment({
                    isPublished: false,
                    isPublishedAnywhere: false
                })
            ]);

            fire(
                document.querySelector('.editBtn'),
                'click'
            );

            expect(
                document.getElementById(
                    'assessmentId'
                ).value
            ).toBe('15');

            expect(
                document.getElementById(
                    'assessmentType'
                ).value
            ).toBe('Fluency');

            expect(
                document.getElementById(
                    'component'
                ).value
            ).toBe('Vocabulary');

            expect(
                document.getElementById(
                    'passingMark'
                ).value
            ).toBe('50');

            expect(
                document.getElementById(
                    'totalMark'
                ).value
            ).toBe('100');

            for (const id of [
                'assessmentType',
                'component',
                'passingMark',
                'totalMark'
            ]) {
                expect(
                    document.getElementById(id).disabled
                ).toBe(false);
            }

            expect(
                document.getElementById('weight').disabled
            ).toBe(true);

            expect(
                document.getElementById(
                    'assessmentModal'
                ).style.display
            ).toBe('flex');
        });

        test('locks core fields for a previously published assessment', async () => {
            await renderAssessments([
                assessment({
                    isPublished: false,
                    isPublishedAnywhere: true
                })
            ]);

            fire(
                document.querySelector('.editBtn'),
                'click'
            );

            for (const id of [
                'assessmentType',
                'component',
                'passingMark',
                'totalMark'
            ]) {
                expect(
                    document.getElementById(id).disabled
                ).toBe(true);
            }

            expect(
                document.getElementById('weight').disabled
            ).toBe(true);

            expect(
                document.getElementById('rubrics').disabled
            ).toBe(false);

            expect(
                document.getElementById(
                    'editLockNotice'
                ).style.display
            ).toBe('block');
        });

        test('submits edit using PUT without weight', async () => {
            fetch
                .mockImplementationOnce(() =>
                    mockResponse({
                        message:
                            'Assessment updated successfully'
                    })
                )
                .mockImplementationOnce(() =>
                    mockResponse({ data: [] })
                );

            fillAssessmentForm({
                id: '15',
                passingMark: '60',
                totalMark: '100',
                weight: '75',
                rubrics: 'Updated rubric.'
            });

            document.getElementById(
                'assessmentModal'
            ).style.display = 'flex';

            fire(
                document.getElementById(
                    'assessmentForm'
                ),
                'submit'
            );

            await flushPromises();

            const [url, options] = fetch.mock.calls[0];
            const body = JSON.parse(options.body);

            expect(url).toBe('/assessments/15');
            expect(options.method).toBe('PUT');

            expect(body).toEqual({
                assessmentType: 'Fluency',
                component: 'Vocabulary',
                passingMark: 60,
                totalMark: 100,
                rubrics: 'Updated rubric.',
                semesterId: 202201,
                band: 'A1'
            });

            expect(body).not.toHaveProperty('weight');

            expect(alert).toHaveBeenCalledWith(
                'Assessment updated successfully'
            );

            expect(
                document.getElementById(
                    'assessmentModal'
                ).style.display
            ).toBe('none');

            expect(fetch).toHaveBeenCalledTimes(2);
        });

        test.each([
            [
                'This assessment has been published before: ' +
                'only rubrics can be changed'
            ],
            ['Assessment not found'],
            ['Failed to update assessment']
        ])(
            'keeps edit modal open when update fails: %s',
            async message => {
                fetch.mockImplementationOnce(() =>
                    mockResponse(
                        { message },
                        false
                    )
                );

                fillAssessmentForm({ id: '15' });

                document.getElementById(
                    'assessmentModal'
                ).style.display = 'flex';

                fire(
                    document.getElementById(
                        'assessmentForm'
                    ),
                    'submit'
                );

                await flushPromises();

                expect(alert).toHaveBeenCalledWith(
                    message
                );

                expect(
                    document.getElementById(
                        'assessmentModal'
                    ).style.display
                ).toBe('flex');

                expect(fetch).toHaveBeenCalledTimes(1);
            }
        );
    });

    describe('Publish Assessment', () => {
        async function openPublishModal() {
            await renderAssessments([
                assessment()
            ]);

            document
                .querySelector('.publishBtn')
                .click();
        }

        test('opens modal with assessment information', async () => {
            document.getElementById('dueDate').value =
                '2026-01-01';

            await openPublishModal();

            expect(
                document.getElementById(
                    'publishAssessmentId'
                ).value
            ).toBe('15');

            expect(
                document.getElementById(
                    'publishAssessmentType'
                ).textContent
            ).toBe('Fluency');

            expect(
                document.getElementById(
                    'publishComponent'
                ).textContent
            ).toBe('Vocabulary');

            expect(
                document.getElementById(
                    'publishBand'
                ).textContent
            ).toBe('A1');

            expect(
                document.getElementById(
                    'publishMarks'
                ).textContent
            ).toBe('50 / 100');

            expect(
                document.getElementById(
                    'dueDate'
                ).value
            ).toBe('');

            expect(
                document.getElementById(
                    'publishModal'
                ).style.display
            ).toBe('flex');
        });

        test('publishes and reloads successfully', async () => {
            await openPublishModal();

            fetch
                .mockImplementationOnce(() =>
                    mockResponse({
                        message:
                            'Assessment published successfully',
                        studentsAssigned: 24
                    })
                )
                .mockImplementationOnce(() =>
                    mockResponse({ data: [] })
                );

            document.getElementById('dueDate').value =
                '2026-09-30';

            fire(
                document.getElementById('publishForm'),
                'submit'
            );

            await flushPromises();

            expect(fetch).toHaveBeenNthCalledWith(
                1,
                '/assessments/15/publish',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        semesterId: '202201',
                        dueDate: '2026-09-30'
                    })
                }
            );

            expect(alert).toHaveBeenCalledWith(
                'Published! 24 students assigned.'
            );

            expect(
                document.getElementById(
                    'publishModal'
                ).style.display
            ).toBe('none');

            expect(fetch).toHaveBeenCalledTimes(2);
        });

        test.each([
            [
                'No students found for this band in this semester'
            ],
            ['Already published for this semester']
        ])(
            'keeps publish modal open on failure: %s',
            async message => {
                await openPublishModal();

                fetch.mockImplementationOnce(() =>
                    mockResponse(
                        { message },
                        false
                    )
                );

                document.getElementById(
                    'dueDate'
                ).value = '2026-09-30';

                fire(
                    document.getElementById(
                        'publishForm'
                    ),
                    'submit'
                );

                await flushPromises();

                expect(alert).toHaveBeenCalledWith(
                    message
                );

                expect(
                    document.getElementById(
                        'publishModal'
                    ).style.display
                ).toBe('flex');

                expect(fetch).toHaveBeenCalledTimes(1);
            }
        );
    });

    describe('Unpublish Assessment', () => {
        async function renderUnpublishButton() {
            await renderAssessments([
                assessment({
                    isPublished: true,
                    isPublishedAnywhere: true,
                    totalSubmitted: 0
                })
            ]);
        }

        test('does nothing when confirmation is cancelled', async () => {
            await renderUnpublishButton();

            confirm.mockReturnValue(false);

            document
                .querySelector('.unpublishBtn')
                .click();

            await flushPromises();

            expect(confirm).toHaveBeenCalled();
            expect(fetch).not.toHaveBeenCalled();
            expect(alert).not.toHaveBeenCalled();
        });

        test('unpublishes and reloads successfully', async () => {
            await renderUnpublishButton();

            confirm.mockReturnValue(true);

            fetch
                .mockImplementationOnce(() =>
                    mockResponse({
                        message:
                            'Assessment unpublished successfully'
                    })
                )
                .mockImplementationOnce(() =>
                    mockResponse({ data: [] })
                );

            document
                .querySelector('.unpublishBtn')
                .click();

            await flushPromises();

            expect(fetch).toHaveBeenNthCalledWith(
                1,
                '/assessments/15/unpublish',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        semesterId: '202201'
                    })
                }
            );

            expect(alert).toHaveBeenCalledWith(
                'Assessment unpublished.'
            );

            expect(fetch).toHaveBeenCalledTimes(2);
        });

        test.each([
            [
                'Cannot unpublish: students have already submitted work'
            ],
            [
                'This assessment is not published for this semester'
            ]
        ])(
            'does not reload when unpublish fails: %s',
            async message => {
                await renderUnpublishButton();

                confirm.mockReturnValue(true);

                fetch.mockImplementationOnce(() =>
                    mockResponse(
                        { message },
                        false
                    )
                );

                document
                    .querySelector('.unpublishBtn')
                    .click();

                await flushPromises();

                expect(alert).toHaveBeenCalledWith(
                    message
                );

                expect(fetch).toHaveBeenCalledTimes(1);
            }
        );
    });

    describe('Delete Assessment', () => {
        async function renderDeleteButton() {
            await renderAssessments([
                assessment({
                    isPublished: false,
                    isPublishedAnywhere: false
                })
            ]);
        }

        test('does nothing when confirmation is cancelled', async () => {
            await renderDeleteButton();

            confirm.mockReturnValue(false);

            fire(
                document.querySelector('.deleteBtn'),
                'click'
            );

            await flushPromises();

            expect(confirm).toHaveBeenCalled();
            expect(fetch).not.toHaveBeenCalled();
            expect(alert).not.toHaveBeenCalled();
        });

        test('deletes and reloads successfully', async () => {
            await renderDeleteButton();

            confirm.mockReturnValue(true);

            fetch
                .mockImplementationOnce(() =>
                    mockResponse({
                        message:
                            'Assessment deleted successfully'
                    })
                )
                .mockImplementationOnce(() =>
                    mockResponse({ data: [] })
                );

            fire(
                document.querySelector('.deleteBtn'),
                'click'
            );

            await flushPromises();

            expect(fetch).toHaveBeenNthCalledWith(
                1,
                '/assessments/15',
                {
                    method: 'DELETE'
                }
            );

            expect(alert).toHaveBeenCalledWith(
                'Assessment deleted.'
            );

            expect(fetch).toHaveBeenCalledTimes(2);
        });

        test.each([
            [
                'Cannot delete: this assessment has published records'
            ],
            ['Assessment not found'],
            ['Failed to delete assessment']
        ])(
            'does not reload when deletion fails: %s',
            async message => {
                await renderDeleteButton();

                confirm.mockReturnValue(true);

                fetch.mockImplementationOnce(() =>
                    mockResponse(
                        { message },
                        false
                    )
                );

                fire(
                    document.querySelector('.deleteBtn'),
                    'click'
                );

                await flushPromises();

                expect(alert).toHaveBeenCalledWith(
                    message
                );

                expect(fetch).toHaveBeenCalledTimes(1);
            }
        );
    });
});