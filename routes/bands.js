const express = require('express');
const BandModel = require('../models/band');
const router = express.Router();

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const ALLOWED_BAND_NAMES = ['Band A1', 'Band A2', 'Band A3', 'Band B4', 'Band B5', 'Band B6', 'Band C7', 'Band C8', 'Band C9'];
const ALLOWED_YEARS = new Set([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
const ALLOWED_SEMESTERS = new Set(['Semester 1', 'Semester 2']);
const ALLOWED_CENTRES = new Set(['Centre 1', 'Centre 2']);
const ALLOWED_EDUCATOR_ROLES = new Set(['Lead Educator', 'Supporting Educator']);

function validTerm(year, semester) {
    return ALLOWED_YEARS.has(Number(year)) && ALLOWED_SEMESTERS.has(semester);
}

const requireBand = asyncRoute(async (req, res, next) => {
    const band = await BandModel.getBand(req.params.bandId);
    if (!band) return res.status(404).render('error', {message: 'Band not found', error: {status: 404}});
    res.locals.band = band;
    next();
});

router.get('/', asyncRoute(async (req, res) => {
    const bands = await BandModel.getBands();
    const bandOrder = ['Band A1', 'Band A2', 'Band A3', 'Band B4', 'Band B5', 'Band B6', 'Band C7', 'Band C8', 'Band C9'];
    const groupedBands = Object.values(bands.reduce((groups, band) => {
        const term = `${band.year} ${band.semester}`;
        groups[term] ||= {term, bands: []};
        groups[term].bands.push(band);
        return groups;
    }, {})).sort((a, b) => b.term.localeCompare(a.term));
    groupedBands.forEach((group) => {
        group.bands.sort((a, b) => bandOrder.indexOf(a.name) - bandOrder.indexOf(b.name));
    });
    res.render('bands/index', {
        groupedBands,
        createError: req.query.error || '',
        formData: {
            name: req.query.name || '',
            year: req.query.year || '',
            semester: req.query.semester || '',
            description: req.query.description || ''
        }
    });
}));

router.post('/', asyncRoute(async (req, res) => {
    const {name, year, semester, description} = req.body;
    const params = new URLSearchParams({name: name || '', year: year || '', semester: semester || '', description: description || ''});
    if (!ALLOWED_BAND_NAMES.includes(name) || !validTerm(year, semester)) {
        params.set('error', 'A valid Band, year and semester are required.');
        return res.redirect(`/bands?${params}`);
    }
    if (String(description || '').length > 2000) {
        params.set('error', 'Band description must be 2000 characters or fewer.');
        return res.redirect(`/bands?${params}`);
    }
    if (await BandModel.bandExists(name, year, semester)) {
        params.set('error', `${name} already exists for ${year} ${semester}.`);
        return res.redirect(`/bands?${params}`);
    }
    const band = await BandModel.createBand({name, year, semester, description: description || ''});
    res.redirect(`/bands/${band.id}/settings`);
}));

// TODO: replace this route with the assessments page
router.get('/:bandId/assessments', requireBand, (req, res) => res.render('placeholder', {
    pageTitle: 'Assessments',
    message: 'This route is ready for the assessment-management feature.',
    todo: 'Replace this placeholder with assessment data and creation workflows.',
    layout: 'band',
    activeSide: 'assessments'
}));

// TODO: Replace this placeholder route with the assessment detail page.
router.get('/:bandId/assessments/:assessmentId', requireBand, (req, res) => {
    const assessment = res.locals.band.assessments.find((item) => item.id === req.params.assessmentId);
    if (!assessment) {
        return res.status(404).render('error', {message: 'Assessment not found', error: {status: 404}});
    }
    res.render('placeholder', {
        pageTitle: assessment.name,
        message: 'This assessment detail page is a placeholder.',
        todo: `Implement the detail page for ${assessment.name}.`,
        layout: 'band',
        activeSide: 'assessments'
    });
});

router.get('/:bandId/enrollment', requireBand, asyncRoute(async (req, res) => {
    const roster = BandModel.getRoster(res.locals.band);
    const availableStudents = await BandModel.getEligibleStudents(res.locals.band);
    res.render('bands/enrollment', {roster, availableStudents, enrollmentError: req.query.error || ''});
}));

router.post('/:bandId/enrollment', requireBand, asyncRoute(async (req, res) => {
    const band = res.locals.band;
    const existingTermBand = await BandModel.getStudentEnrollmentForTerm(
        req.body.studentId,
        band.year,
        band.semester
    );
    if (existingTermBand) {
        const message = `This student is already enrolled in ${existingTermBand.name} for ${band.year} ${band.semester}.`;
        return res.redirect(`/bands/${band.id}/enrollment?error=${encodeURIComponent(message)}`);
    }

    const eligibleIds = new Set((await BandModel.getEligibleStudents(res.locals.band)).map((student) => student.id));
    if (!eligibleIds.has(req.body.studentId)) {
        return res.redirect(`/bands/${req.params.bandId}/enrollment?error=${encodeURIComponent('This student is not eligible for this Band movement.')}`);
    }
    // The earlier enrollment is intentionally retained as Band history.
    if (!await BandModel.addEnrollment(req.params.bandId, req.body.studentId)) {
        return res.redirect(`/bands/${req.params.bandId}/enrollment?error=${encodeURIComponent('The student could not be added to this Band.')}`);
    }
    res.redirect(`/bands/${req.params.bandId}/enrollment`);
}));

router.post('/:bandId/enrollment/:studentId/delete', requireBand, asyncRoute(async (req, res) => {
    await BandModel.removeEnrollment(req.params.bandId, req.params.studentId);
    res.redirect(`/bands/${req.params.bandId}/enrollment`);
}));

router.get('/:bandId/enrollment.csv', requireBand, (req, res) => {
    const rows = BandModel.getRoster(res.locals.band);
    const csv = ['Name,Submissions,Graded,Pending Review,Score,Centre,School Level']
        .concat(rows.map((student) => [student.name, `${student.submissionsPercent}%`, `${student.gradedPercent}%`, student.pendingReview, student.scorePercent === null ? '' : `${student.scorePercent}%`, student.centre, student.schoolLevel]
            .map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')))
        .join('\r\n');
    res.set({'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${res.locals.band.name}-enrollment.csv"`});
    res.send(csv);
});

router.get('/:bandId/settings', requireBand, (req, res) => res.render('bands/settings', {error: req.query.error || '', saved: req.query.saved === '1'}));

router.post('/:bandId/settings', requireBand, asyncRoute(async (req, res) => {
    const band = res.locals.band;
    if (!validTerm(req.body.year, req.body.semester)) {
        return res.redirect(`/bands/${band.id}/settings?error=${encodeURIComponent('A valid year and semester are required.')}`);
    }
    if (String(req.body.description || '').length > 2000) {
        return res.redirect(`/bands/${band.id}/settings?error=${encodeURIComponent('Band description must be 2000 characters or fewer.')}`);
    }
    if (await BandModel.bandExists(band.name, req.body.year, req.body.semester, band.id)) {
        const message = `${band.name} already exists for ${req.body.year} ${req.body.semester}.`;
        return res.redirect(`/bands/${band.id}/settings?error=${encodeURIComponent(message)}`);
    }

    const enrollmentConflicts = await BandModel.getEnrollmentConflictsForTerm(
        band.id,
        req.body.year,
        req.body.semester
    );
    if (enrollmentConflicts.length) {
        const message = `${enrollmentConflicts.length} enrolled student(s) already belong to another Band for ${req.body.year} ${req.body.semester}.`;
        return res.redirect(`/bands/${band.id}/settings?error=${encodeURIComponent(message)}`);
    }

    const weights = {};
    band.assessments.forEach((assessment) => { weights[assessment.id] = Number(req.body[`weight_${assessment.id}`]); });
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const weightsAreValid = Object.values(weights).every((weight) => Number.isFinite(weight) && weight >= 0 && weight <= 100);
    if (band.assessments.length && (!weightsAreValid || Math.abs(total - 100) > 0.0001)) {
        return res.redirect(`/bands/${band.id}/settings?error=${encodeURIComponent('Assessment weightages must each be between 0% and 100% and add up to exactly 100%.')}`);
    }

    const names = [].concat(req.body.educatorName || []);
    const centres = [].concat(req.body.educatorCentre || []);
    const roles = [].concat(req.body.educatorRole || []);
    const educatorsAreValid = names.length === centres.length && names.length === roles.length && names.every((name, index) =>
        typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 100 &&
        ALLOWED_CENTRES.has(centres[index]) && ALLOWED_EDUCATOR_ROLES.has(roles[index])
    );
    if (!educatorsAreValid) {
        return res.redirect(`/bands/${band.id}/settings?error=${encodeURIComponent('Each educator must have a valid name, centre and role.')}`);
    }
    const educators = names.map((name, index) => ({
        id: `educator-${index}-${Date.now()}`,
        name: name.trim(),
        centre: centres[index],
        role: roles[index]
    }));
    const updatedBand = await BandModel.updateBand(band.id, {year: req.body.year, semester: req.body.semester, description: req.body.description, weights, educators});
    if (!updatedBand) {
        return res.redirect(`/bands/${band.id}/settings?error=${encodeURIComponent('The Band could not be updated because its term conflicts with another enrollment.')}`);
    }
    res.redirect(`/bands/${band.id}/settings?saved=1`);
}));

router.post('/:bandId/delete', requireBand, asyncRoute(async (req, res) => {
    await BandModel.deleteBand(req.params.bandId);
    res.redirect('/bands');
}));

router.get('/:bandId/students/:studentId', requireBand, asyncRoute(async (req, res) => {
    const dashboard = BandModel.getStudentDashboard(res.locals.band, req.params.studentId);
    if (!dashboard) return res.status(404).render('error', {message: 'Enrollment not found', error: {status: 404}});
    const pastBands = await BandModel.getPastBands(req.params.studentId, res.locals.band);
    res.render('students/dashboard', {...dashboard, pastBands});
}));

function renderStudentPlaceholder(pageTitle) {
    return asyncRoute(async (req, res) => {
        const student = (await BandModel.getStudents()).find((item) => item.id === req.params.studentId);
        if (!student) return res.status(404).render('error', {message: 'Student not found', error: {status: 404}});
        res.render('placeholder', { // TODO: replace with the student profile 
            pageTitle,
            student,
            message: `${pageTitle} is coming soon.`,
            todo: `Implement the ${pageTitle.toLowerCase()} student profile section.`,
            layout: 'student',
            activeSide: pageTitle === 'Progress' ? 'progress' : 'info'
        });
    });
}
router.get('/:bandId/students/:studentId/progress', requireBand, renderStudentPlaceholder('Progress'));
router.get('/:bandId/students/:studentId/info', requireBand, renderStudentPlaceholder('Student Info'));
router.get('/:bandId/students/:studentId/assessments/:assessmentId/:action', requireBand, (req, res) => {
    const action = req.params.action === 'review' ? 'Review Assessment' : 'Upload Assessment';
    res.render('placeholder', { // TODO: replace with assessment upload/review route
        pageTitle: action,
        message: 'This assessment workflow is a placeholder.',
        todo: `Implement ${req.params.action} for assessment ${req.params.assessmentId}.`,
        layout: 'standalone',
        activeTop: 'bands',
        backUrl: `/bands/${req.params.bandId}/students/${req.params.studentId}`,
        backLabel: 'Back to Student Dashboard'
    });
});

module.exports = router;
