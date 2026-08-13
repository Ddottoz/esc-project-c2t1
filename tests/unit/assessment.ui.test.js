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

function createDOM() {
    document.body.innerHTML = `
        <h1 id="assessmentCountTitle"></h1>

        <select
            class="filterInput"
            id="filterAssessmentType"
            name="assessmentType"
        >
            <option value="">All Types</option>
            <option value="Fluency">Fluency</option>
        </select>

        <select
            class="filterInput"
            id="filterComponent"
            name="component"
        >
            <option value="">All Components</option>
            <option value="Vocabulary">Vocabulary</option>
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

                <button
                    id="cancelModalBtn"
                    type="button"
                >
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
                <input
                    id="publishAssessmentId"
                    type="hidden"
                >

                <input id="dueDate" type="date">

                <button
                    id="cancelPublishBtn"
                    type="button"
                >
                    Cancel
                </button>

                <button type="submit">Publish</button>
            </form>
        </div>

        <div id="rubricsModal" style="display: none;">
            <p id="rubricsModalContent"></p>

            <button
                id="closeRubricsBtn"
                type="button"
            >
                Close
            </button>
        </div>
    `;

    document.body.dataset.semesterBandId =
        'band-a1-2022-s1';

    document.body.dataset.semesterId = '202201';
    document.body.dataset.band = 'A1';
}

function createAssessment(overrides = {}) {
    return {
        assessmentId: 5,
        assessmentType: 'Fluency',
        component: 'Vocabulary',
        band: 'A1',
        passingMark: 50,
        totalMark: 100,
        weight: 0,
        rubrics: 'Read each word clearly.',
        totalAssigned: 10,
        totalSubmitted: 0,
        totalGraded: 0,
        isPublished: false,
        isPublishedAnywhere: false,
        ...overrides
    };
}

function fire(element, eventType) {
    element.dispatchEvent(
        new Event(eventType, {
            bubbles: true,
            cancelable: true
        })
    );
}

function clickSvg(element) {
    element.dispatchEvent(
        new MouseEvent('click', {
            bubbles: true,
            cancelable: true
        })
    );
}

async function loadUsingFilter() {
    fire(
        document.getElementById(
            'filterAssessmentType'
        ),
        'change'
    );

    await flushPromises();
}

function fillAssessmentForm({
    id = '',
    weight = '0'
} = {}) {
    document.getElementById('assessmentId').value =
        id;

    document.getElementById('assessmentType').value =
        'Fluency';

    document.getElementById('component').value =
        'Vocabulary';

    document.getElementById('passingMark').value =
        '50';

    document.getElementById('totalMark').value =
        '100';

    document.getElementById('weight').value =
        weight;

    document.getElementById('rubrics').value =
        'Test rubric';
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

        /*
         * Requiring the browser JavaScript attaches
         * its event listeners to the test DOM.
         */
        require(
            '../../public/javascripts/assessmentList'
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();

        delete global.fetch;
        delete global.alert;
        delete global.confirm;
    });

    describe('loading and filtering assessments', () => {
        test('loads assessments using semesterBandId', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: []
                })
            );

            await loadUsingFilter();

            expect(fetch).toHaveBeenCalledWith(
                '/assessments/semBand/' +
                    'band-a1-2022-s1',
                {
                    cache: 'no-store'
                }
            );
        });

        test('adds selected filters to request URL', async () => {
            document.getElementById(
                'filterAssessmentType'
            ).value = 'Fluency';

            document.getElementById(
                'filterComponent'
            ).value = 'Vocabulary';

            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: []
                })
            );

            await loadUsingFilter();

            expect(fetch).toHaveBeenCalledWith(
                '/assessments/semBand/' +
                    'band-a1-2022-s1' +
                    '?assessmentType=Fluency' +
                    '&component=Vocabulary',
                {
                    cache: 'no-store'
                }
            );
        });

        test('reloads when component filter receives input', async () => {
            document.getElementById(
                'filterComponent'
            ).value = 'Vocabulary';

            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: []
                })
            );

            fire(
                document.getElementById(
                    'filterComponent'
                ),
                'input'
            );

            await flushPromises();

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining(
                    'component=Vocabulary'
                ),
                {
                    cache: 'no-store'
                }
            );
        });

        test('shows API error when loading fails', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse(
                    {
                        message:
                            'Semester band not found'
                    },
                    false
                )
            );

            await loadUsingFilter();

            expect(console.error)
                .toHaveBeenCalled();

            expect(alert).toHaveBeenCalledWith(
                'Semester band not found'
            );
        });

        test('uses fallback error message', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse({}, false)
            );

            await loadUsingFilter();

            expect(alert).toHaveBeenCalledWith(
                'Failed to fetch assessments'
            );
        });

        test('handles rejected fetch request', async () => {
            fetch.mockRejectedValueOnce(
                new Error('Network failure')
            );

            await loadUsingFilter();

            expect(console.error)
                .toHaveBeenCalled();

            expect(alert).toHaveBeenCalledWith(
                'Network failure'
            );
        });
    });

    describe('rendering assessments', () => {
        test('renders empty state and count', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: []
                })
            );

            await loadUsingFilter();

            expect(
                document.getElementById(
                    'assessmentCountTitle'
                ).textContent
            ).toBe('0 Assessments');

            expect(
                document.getElementById(
                    'assessmentTableBody'
                ).textContent
            ).toContain('No assessments found');

            expect(
                document
                    .querySelector(
                        '#assessmentTableBody td'
                    )
                    .getAttribute('colspan')
            ).toBe('10');
        });

        test('renders assessment and submission link', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: [
                        createAssessment()
                    ]
                })
            );

            await loadUsingFilter();

            const tableBody =
                document.getElementById(
                    'assessmentTableBody'
                );

            const link =
                tableBody.querySelector('a');

            expect(
                document.getElementById(
                    'assessmentCountTitle'
                ).textContent
            ).toBe('1 Assessments');

            expect(tableBody.textContent)
                .toContain('Fluency');

            expect(tableBody.textContent)
                .toContain('Vocabulary');

            expect(tableBody.textContent)
                .toContain('0 / 10');

            expect(
                link.getAttribute('href')
            ).toBe(
                '/submission/202201/A1/Fluency'
            );
        });

        test('replaces spaces in assessment type URL', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: [
                        createAssessment({
                            assessmentType:
                                'Word Reading Accuracy'
                        })
                    ]
                })
            );

            await loadUsingFilter();

            expect(
                document
                    .querySelector(
                        '#assessmentTableBody a'
                    )
                    .getAttribute('href')
            ).toBe(
                '/submission/202201/A1/' +
                'Word_Reading_Accuracy'
            );
        });

        test('shows publish, edit and delete for never-published assessment', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: [
                        createAssessment()
                    ]
                })
            );

            await loadUsingFilter();

            expect(
                document.querySelector('.publishBtn')
            ).not.toBeNull();

            expect(
                document.querySelector('.editBtn')
            ).not.toBeNull();

            expect(
                document.querySelector('.deleteBtn')
            ).not.toBeNull();

            expect(
                document.querySelector('.unpublishBtn')
            ).toBeNull();
        });

        test('shows unpublish when published with no submissions', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: [
                        createAssessment({
                            isPublished: true,
                            isPublishedAnywhere: true,
                            totalSubmitted: 0
                        })
                    ]
                })
            );

            await loadUsingFilter();

            expect(
                document.querySelector('.unpublishBtn')
            ).not.toBeNull();

            expect(
                document.querySelector('.publishBtn')
            ).toBeNull();

            expect(
                document.querySelector('.editBtn')
            ).toBeNull();

            expect(
                document.querySelector('.deleteBtn')
            ).toBeNull();
        });

        test('hides unpublish after submission exists', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: [
                        createAssessment({
                            isPublished: true,
                            isPublishedAnywhere: true,
                            totalSubmitted: 1
                        })
                    ]
                })
            );

            await loadUsingFilter();

            expect(
                document.querySelector('.publishBtn')
            ).toBeNull();

            expect(
                document.querySelector('.unpublishBtn')
            ).toBeNull();

            expect(
                document.querySelector('.editBtn')
            ).toBeNull();

            expect(
                document.querySelector('.deleteBtn')
            ).toBeNull();
        });

        test('shows dash when rubrics are null', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: [
                        createAssessment({
                            rubrics: null
                        })
                    ]
                })
            );

            await loadUsingFilter();

            expect(
                document.querySelector(
                    '.viewRubricsBtn'
                )
            ).toBeNull();

            expect(
                document.getElementById(
                    'assessmentTableBody'
                ).textContent
            ).toContain('-');
        });
    });

    describe('create and edit modal', () => {
        test('opens reset and enabled create form', () => {
            fillAssessmentForm({
                id: '5',
                weight: '25'
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

            expect(
                document.getElementById(
                    'assessmentType'
                ).disabled
            ).toBe(false);

            expect(
                document.getElementById(
                    'component'
                ).disabled
            ).toBe(false);

            expect(
                document.getElementById(
                    'passingMark'
                ).disabled
            ).toBe(false);

            expect(
                document.getElementById(
                    'totalMark'
                ).disabled
            ).toBe(false);

            /*
             * Weight remains disabled because it is
             * managed through Band Settings.
             */
            expect(
                document.getElementById(
                    'weight'
                ).disabled
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

        test('closes assessment modal on Cancel', () => {
            document.getElementById(
                'assessmentModal'
            ).style.display = 'flex';

            document.getElementById(
                'cancelModalBtn'
            ).click();

            expect(
                document.getElementById(
                    'assessmentModal'
                ).style.display
            ).toBe('none');
        });

        test('populates unpublished assessment for editing', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: [
                        createAssessment()
                    ]
                })
            );

            await loadUsingFilter();

            clickSvg(
                document.querySelector('.editBtn')
            );

            expect(
                document.getElementById(
                    'assessmentId'
                ).value
            ).toBe('5');

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

            expect(
                document.getElementById(
                    'weight'
                ).value
            ).toBe('0');

            expect(
                document.getElementById(
                    'weight'
                ).disabled
            ).toBe(true);

            expect(
                document.getElementById(
                    'rubrics'
                ).value
            ).toBe('Read each word clearly.');

            expect(
                document.getElementById(
                    'modalTitle'
                ).textContent
            ).toBe('Edit Assessment');

            expect(
                document.getElementById(
                    'assessmentType'
                ).disabled
            ).toBe(false);

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

        test('locks core fields after past publication', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: [
                        createAssessment({
                            isPublished: false,
                            isPublishedAnywhere: true
                        })
                    ]
                })
            );

            await loadUsingFilter();

            clickSvg(
                document.querySelector('.editBtn')
            );

            expect(
                document.getElementById(
                    'assessmentType'
                ).disabled
            ).toBe(true);

            expect(
                document.getElementById(
                    'component'
                ).disabled
            ).toBe(true);

            expect(
                document.getElementById(
                    'passingMark'
                ).disabled
            ).toBe(true);

            expect(
                document.getElementById(
                    'totalMark'
                ).disabled
            ).toBe(true);

            expect(
                document.getElementById(
                    'weight'
                ).disabled
            ).toBe(true);

            expect(
                document.getElementById(
                    'rubrics'
                ).disabled
            ).toBe(false);

            expect(
                document.getElementById(
                    'editLockNotice'
                ).style.display
            ).toBe('block');
        });

        test('opens and closes rubrics modal', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: [
                        createAssessment()
                    ]
                })
            );

            await loadUsingFilter();

            clickSvg(
                document.querySelector(
                    '.viewRubricsBtn'
                )
            );

            expect(
                document.getElementById(
                    'rubricsModalContent'
                ).textContent
            ).toBe('Read each word clearly.');

            expect(
                document.getElementById(
                    'rubricsModal'
                ).style.display
            ).toBe('flex');

            document.getElementById(
                'closeRubricsBtn'
            ).click();

            expect(
                document.getElementById(
                    'rubricsModal'
                ).style.display
            ).toBe('none');
        });
    });

    describe('creating and updating assessments', () => {
        test('POSTs assessment without weight', async () => {
            fetch
                .mockImplementationOnce(() =>
                    mockResponse({
                        message:
                            'Assessment created successfully',
                        assessmentId: 10
                    })
                )
                .mockImplementationOnce(() =>
                    mockResponse({
                        data: []
                    })
                );

            fillAssessmentForm({
                id: '',
                weight: '0'
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

            expect(fetch).toHaveBeenNthCalledWith(
                1,
                '/assessments',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json'
                    },
                    body: JSON.stringify({
                        assessmentType: 'Fluency',
                        component: 'Vocabulary',
                        passingMark: 50,
                        totalMark: 100,
                        rubrics: 'Test rubric',
                        semesterId: 202201,
                        band: 'A1'
                    })
                }
            );

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

        test('keeps modal open when creation fails', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse(
                    {
                        message:
                            'Assessment type already ' +
                            'exists for this band'
                    },
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
                'Assessment type already ' +
                'exists for this band'
            );

            expect(
                document.getElementById(
                    'assessmentModal'
                ).style.display
            ).toBe('flex');

            expect(fetch).toHaveBeenCalledTimes(1);
        });

        test('PUTs assessment without weight', async () => {
            fetch
                .mockImplementationOnce(() =>
                    mockResponse({
                        message:
                            'Assessment updated successfully'
                    })
                )
                .mockImplementationOnce(() =>
                    mockResponse({
                        data: []
                    })
                );

            fillAssessmentForm({
                id: '5',
                weight: '0'
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

            expect(fetch).toHaveBeenNthCalledWith(
                1,
                '/assessments/5',
                expect.objectContaining({
                    method: 'PUT',
                    body: expect.any(String)
                })
            );

            expect(
                JSON.parse(
                    fetch.mock.calls[0][1].body
                )
            ).toEqual({
                assessmentType: 'Fluency',
                component: 'Vocabulary',
                passingMark: 50,
                totalMark: 100,
                rubrics: 'Test rubric',
                semesterId: 202201,
                band: 'A1'
            });

            expect(
                document.getElementById(
                    'assessmentModal'
                ).style.display
            ).toBe('none');

            expect(fetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('publishing assessments', () => {
        async function renderPublishButton() {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: [
                        createAssessment()
                    ]
                })
            );

            await loadUsingFilter();
        }

        test('opens publish modal with details', async () => {
            await renderPublishButton();

            document
                .querySelector('.publishBtn')
                .click();

            expect(
                document.getElementById(
                    'publishAssessmentId'
                ).value
            ).toBe('5');

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
                    'publishModal'
                ).style.display
            ).toBe('flex');
        });

        test('closes publish modal on Cancel', () => {
            document.getElementById(
                'publishModal'
            ).style.display = 'flex';

            document.getElementById(
                'cancelPublishBtn'
            ).click();

            expect(
                document.getElementById(
                    'publishModal'
                ).style.display
            ).toBe('none');
        });

        test('publishes and refreshes successfully', async () => {
            fetch
                .mockImplementationOnce(() =>
                    mockResponse({
                        studentsAssigned: 24
                    })
                )
                .mockImplementationOnce(() =>
                    mockResponse({
                        data: []
                    })
                );

            document.getElementById(
                'publishAssessmentId'
            ).value = '5';

            document.getElementById(
                'dueDate'
            ).value = '2026-09-30';

            document.getElementById(
                'publishModal'
            ).style.display = 'flex';

            fire(
                document.getElementById(
                    'publishForm'
                ),
                'submit'
            );

            await flushPromises();

            expect(fetch).toHaveBeenNthCalledWith(
                1,
                '/assessments/5/publish',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json'
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

        test('keeps publish modal open on failure', async () => {
            fetch.mockImplementationOnce(() =>
                mockResponse(
                    {
                        message:
                            'No students found for this ' +
                            'band in this semester'
                    },
                    false
                )
            );

            document.getElementById(
                'publishAssessmentId'
            ).value = '5';

            document.getElementById(
                'dueDate'
            ).value = '2026-09-30';

            document.getElementById(
                'publishModal'
            ).style.display = 'flex';

            fire(
                document.getElementById(
                    'publishForm'
                ),
                'submit'
            );

            await flushPromises();

            expect(alert).toHaveBeenCalledWith(
                'No students found for this ' +
                'band in this semester'
            );

            expect(
                document.getElementById(
                    'publishModal'
                ).style.display
            ).toBe('flex');

            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('unpublishing assessments', () => {
        async function renderUnpublishButton() {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: [
                        createAssessment({
                            isPublished: true,
                            isPublishedAnywhere: true,
                            totalSubmitted: 0
                        })
                    ]
                })
            );

            await loadUsingFilter();
        }

        test('does nothing when confirmation cancelled', async () => {
            await renderUnpublishButton();

            fetch.mockClear();
            confirm.mockReturnValue(false);

            document
                .querySelector('.unpublishBtn')
                .click();

            await flushPromises();

            expect(confirm).toHaveBeenCalled();

            expect(fetch).not.toHaveBeenCalled();
        });

        test('unpublishes and refreshes successfully', async () => {
            await renderUnpublishButton();

            fetch.mockClear();
            confirm.mockReturnValue(true);

            fetch
                .mockImplementationOnce(() =>
                    mockResponse({
                        message:
                            'Assessment unpublished ' +
                            'successfully'
                    })
                )
                .mockImplementationOnce(() =>
                    mockResponse({
                        data: []
                    })
                );

            document
                .querySelector('.unpublishBtn')
                .click();

            await flushPromises();

            expect(fetch).toHaveBeenNthCalledWith(
                1,
                '/assessments/5/unpublish',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json'
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

        test('does not refresh when unpublish fails', async () => {
            await renderUnpublishButton();

            fetch.mockClear();
            confirm.mockReturnValue(true);

            fetch.mockImplementationOnce(() =>
                mockResponse(
                    {
                        message:
                            'Cannot unpublish: students ' +
                            'have already submitted work'
                    },
                    false
                )
            );

            document
                .querySelector('.unpublishBtn')
                .click();

            await flushPromises();

            expect(alert).toHaveBeenCalledWith(
                'Cannot unpublish: students ' +
                'have already submitted work'
            );

            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('deleting assessments', () => {
        async function renderDeleteButton() {
            fetch.mockImplementationOnce(() =>
                mockResponse({
                    data: [
                        createAssessment()
                    ]
                })
            );

            await loadUsingFilter();
        }

        test('does nothing when confirmation cancelled', async () => {
            await renderDeleteButton();

            fetch.mockClear();
            confirm.mockReturnValue(false);

            clickSvg(
                document.querySelector('.deleteBtn')
            );

            await flushPromises();

            expect(confirm).toHaveBeenCalled();

            expect(fetch).not.toHaveBeenCalled();
        });

        test('deletes and refreshes successfully', async () => {
            await renderDeleteButton();

            fetch.mockClear();
            confirm.mockReturnValue(true);

            fetch
                .mockImplementationOnce(() =>
                    mockResponse({
                        message:
                            'Assessment deleted successfully'
                    })
                )
                .mockImplementationOnce(() =>
                    mockResponse({
                        data: []
                    })
                );

            clickSvg(
                document.querySelector('.deleteBtn')
            );

            await flushPromises();

            expect(fetch).toHaveBeenNthCalledWith(
                1,
                '/assessments/5',
                {
                    method: 'DELETE'
                }
            );

            expect(alert).toHaveBeenCalledWith(
                'Assessment deleted.'
            );

            expect(fetch).toHaveBeenCalledTimes(2);
        });

        test('does not refresh when delete fails', async () => {
            await renderDeleteButton();

            fetch.mockClear();
            confirm.mockReturnValue(true);

            fetch.mockImplementationOnce(() =>
                mockResponse(
                    {
                        message:
                            'Cannot delete: this assessment ' +
                            'has published records'
                    },
                    false
                )
            );

            clickSvg(
                document.querySelector('.deleteBtn')
            );

            await flushPromises();

            expect(alert).toHaveBeenCalledWith(
                'Cannot delete: this assessment ' +
                'has published records'
            );

            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });
});