const express = require('express');
const router = express.Router();
const EducatorModel = require('../models/educator');

// The logged-in educator's id is stored in a cookie when they log in.
// Returns the id, or null if nobody is logged in.
function loggedInEducatorId(req) {
    const id = Number(req.cookies.educatorId);
    return id ? id : null;
}

async function showPage(res, educatorId, message) {
    const educator = await EducatorModel.getEducatorById(educatorId);
    if (!educator) return res.status(404).send('Educator not found');

    const name = EducatorModel.splitName(educator.educatorName);
    const programmes = await EducatorModel.getProgrammes(educator.educatorName);
    res.render('edit-educator', {
        educator: educator,
        firstName: name.firstName,
        lastName: name.lastName,
        programmes: programmes,
        message: message
    });
}

router.get('/', async (req, res, next) => {
    try {
        const educatorId = loggedInEducatorId(req);
        if (!educatorId) return res.redirect('/login');
        await showPage(res, educatorId, '');
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const educatorId = loggedInEducatorId(req);
        if (!educatorId) return res.redirect('/login');

        const firstName = (req.body.firstName || '').trim();
        const lastName = (req.body.lastName || '').trim();
        const email = (req.body.email || '').trim();
        const newPassword = req.body.newPassword;
        const confirmPassword = req.body.confirmPassword;

        const error = EducatorModel.checkForm(firstName, email, newPassword, confirmPassword);
        if (error) {
            return showPage(res, educatorId, error);
        }
        if (await EducatorModel.emailTaken(email, educatorId)) {
            return showPage(res, educatorId, 'Another educator is already using that email');
        }

        await EducatorModel.updateEducator(educatorId, firstName, lastName, email);
        if (newPassword) {
            await EducatorModel.updatePassword(educatorId, newPassword);
        }
        await showPage(res, educatorId, 'Changes saved');
    } catch (err) {
        next(err);
    }
});

module.exports = router;
