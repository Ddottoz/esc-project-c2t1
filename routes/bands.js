const express = require('express');
const bandController = require('../controllers/BandController');
const enrollmentController = require('../controllers/EnrollmentController');
const studentDashboardController = require('../controllers/StudentDashboardController');

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function redirectWithError(res, path, error) {
    return res.redirect(`${path}?error=${encodeURIComponent(error.message)}`);
}

function createFormData(body = {}) {
    return {
        name: body.name || '',
        year: body.year || '',
        semester: body.semester || '',
        description: body.description || ''
    };
}

function settingsDraft(body, band) {
    // turns the settings form fields into one controller draft
    const weights = {};
    band.assessments.forEach((assessment) => {
        weights[assessment.id] = Number(body[`weight_${assessment.id}`]);
    });
    const names = [].concat(body.educatorName || []);
    const centres = [].concat(body.educatorCentre || []);
    const roles = [].concat(body.educatorRole || []);
    return {
        year: body.year,
        semester: body.semester,
        description: body.description || '',
        weights,
        educators: names.map((name, index) => ({
            name: String(name).trim(),
            centre: centres[index],
            role: roles[index]
        }))
    };
}

const requireBand = asyncRoute(async (req, res, next) => {
    const band = await bandController.getBandSettings(req.params.bandId);
    if (!band) {
        return res.status(404).render('error', {message: 'Band not found', error: {status: 404}});
    }
    res.locals.band = band;
    next();
});

// UC1 - view and create Bands
router.get('/', asyncRoute(async (req, res) => {
    const bands = await bandController.listBandCohorts();
    const groupedBands = Object.values(bands.reduce((groups, band) => {
        const term = `${band.year} ${band.semester}`;
        groups[term] ||= {term, bands: []};
        groups[term].bands.push(band);
        return groups;
    }, {})).sort((a, b) => b.term.localeCompare(a.term));
    groupedBands.forEach((group) => group.bands.sort(
        (a, b) => bandController.BAND_NAMES.indexOf(a.name) - bandController.BAND_NAMES.indexOf(b.name)
    ));
    res.render('bands/index', {
        groupedBands,
        createError: req.query.error || '',
        formData: createFormData(req.query)
    });
}));

router.post('/', asyncRoute(async (req, res) => {
    try {
        const band = await bandController.createBandCohort(createFormData(req.body));
        res.redirect(`/bands/${band.id}/settings`);
    } catch (error) {
        if (error.name !== 'ValidationError') throw error;
        const query = new URLSearchParams({...createFormData(req.body), error: error.message});
        res.redirect(`/bands?${query}`);
    }
}));

// keep the working assessment routes from main
router.get('/:bandId/assessments', requireBand, (req, res) => {
    res.redirect(`/assessments/${req.params.bandId}/view`);
});

router.get('/:bandId/assessments/:assessmentId', requireBand, (req, res) => {
    const assessment = res.locals.band.assessments.find((item) => item.id === req.params.assessmentId);
    if (!assessment) {
        return res.status(404).render('error', {message: 'Assessment not found', error: {status: 404}});
    }
    const type = encodeURIComponent(assessment.assessmentType.replace(/ /g, '_'));
    res.redirect(`/submission/${res.locals.band.semesterId}/${encodeURIComponent(res.locals.band.bandCode)}/${type}`);
});

// UC3 - manage Band enrollment
router.get('/:bandId/enrollment', requireBand, asyncRoute(async (req, res) => {
    const [roster, availableStudents] = await Promise.all([
        enrollmentController.getRoster(req.params.bandId),
        enrollmentController.getEligibleStudents(req.params.bandId)
    ]);
    res.render('bands/enrollment', {
        roster,
        availableStudents,
        enrollmentError: req.query.error || ''
    });
}));

router.post('/:bandId/enrollment', requireBand, asyncRoute(async (req, res) => {
    try {
        await enrollmentController.addStudent(req.params.bandId, req.body.studentId, req.body.movement);
        res.redirect(`/bands/${req.params.bandId}/enrollment`);
    } catch (error) {
        if (error.name !== 'ValidationError') throw error;
        redirectWithError(res, `/bands/${req.params.bandId}/enrollment`, error);
    }
}));

router.post('/:bandId/enrollment/:studentId/delete', requireBand, asyncRoute(async (req, res) => {
    await enrollmentController.removeStudent(req.params.bandId, req.params.studentId);
    res.redirect(`/bands/${req.params.bandId}/enrollment`);
}));

router.get('/:bandId/enrollment.csv', requireBand, asyncRoute(async (req, res) => {
    const file = await enrollmentController.exportRosterCsv(req.params.bandId);
    res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${file.filename}"`
    });
    res.send(file.content);
}));

// UC2 - edit or delete Band settings
router.get('/:bandId/settings', requireBand, (req, res) => res.render('bands/settings', {
    error: req.query.error || '',
    saved: req.query.saved === '1'
}));

router.post('/:bandId/settings', requireBand, asyncRoute(async (req, res) => {
    try {
        await bandController.updateBandSettings(req.params.bandId, settingsDraft(req.body, res.locals.band));
        res.redirect(`/bands/${req.params.bandId}/settings?saved=1`);
    } catch (error) {
        if (error.name !== 'ValidationError') throw error;
        redirectWithError(res, `/bands/${req.params.bandId}/settings`, error);
    }
}));

router.post('/:bandId/delete', requireBand, asyncRoute(async (req, res) => {
    await bandController.deleteBandCohort(req.params.bandId);
    res.redirect('/bands');
}));

// UC4 - view the student Band dashboard
router.get('/:bandId/students/:studentId', requireBand, asyncRoute(async (req, res) => {
    const dashboard = await studentDashboardController.getDashboard(req.params.studentId, req.params.bandId);
    if (!dashboard) {
        return res.status(404).render('error', {message: 'Enrollment not found', error: {status: 404}});
    }
    res.render('students/dashboard', dashboard);
}));

// keep the working student routes from main
router.get('/:bandId/students/:studentId/progress', requireBand, (req, res) => {
    res.redirect(`/reports/student/${encodeURIComponent(req.params.studentId)}`);
});

router.get('/:bandId/students/:studentId/info', requireBand, (req, res) => {
    res.redirect(`/add-edit-student.html?id=${encodeURIComponent(req.params.studentId)}`);
});

router.get('/:bandId/students/:studentId/assessments/:assessmentId/:action', requireBand, asyncRoute(async (req, res) => {
    const dashboard = await studentDashboardController.getDashboard(req.params.studentId, req.params.bandId);
    if (!dashboard) {
        return res.status(404).render('error', {message: 'Enrollment not found', error: {status: 404}});
    }
    const assessment = dashboard.assessments.find((item) => item.id === req.params.assessmentId);
    if (!assessment || !assessment.submission.studentAssessmentId) {
        return res.status(404).render('error', {message: 'Student assessment not found', error: {status: 404}});
    }
    if (req.params.action === 'upload') {
        return res.redirect(`/upload/${assessment.submission.studentAssessmentId}`);
    }
    if (req.params.action === 'review' && assessment.submission.hasAnalysis) {
        return res.redirect(`/viewanalysis/${assessment.submission.studentAssessmentId}`);
    }
    return res.status(404).render('error', {message: 'Assessment analysis not found', error: {status: 404}});
}));

module.exports = router;
