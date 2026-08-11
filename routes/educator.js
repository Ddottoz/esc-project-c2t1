const express = require('express');
const router = express.Router();
const EducatorModel = require('../models/educator');

// There is no login yet, so we always edit this educator.
// Replace this with the logged in educator's id once auth is built.
const CURRENT_EDUCATOR_ID = 2;

async function showPage(res, message) {
    const educator = await EducatorModel.getEducatorById(CURRENT_EDUCATOR_ID);
    if (!educator) return res.status(404).send('Educator not found');

    const name = EducatorModel.splitName(educator.educatorName);
    res.render('edit-educator', {
        educator: educator,
        firstName: name.firstName,
        lastName: name.lastName,
        message: message
    });
}

router.get('/', async (req, res, next) => {
    try {
        await showPage(res, '');
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const firstName = (req.body.firstName || '').trim();
        const lastName = (req.body.lastName || '').trim();
        const email = (req.body.email || '').trim();
        const newPassword = req.body.newPassword;
        const confirmPassword = req.body.confirmPassword;

        const error = EducatorModel.checkForm(firstName, email, newPassword, confirmPassword);
        if (error) {
            return showPage(res, error);
        }
        if (await EducatorModel.emailTaken(email, CURRENT_EDUCATOR_ID)) {
            return showPage(res, 'Another educator is already using that email');
        }

        await EducatorModel.updateEducator(CURRENT_EDUCATOR_ID, firstName, lastName, email);
        if (newPassword) {
            await EducatorModel.updatePassword(CURRENT_EDUCATOR_ID, newPassword);
        }
        await showPage(res, 'Changes saved');
    } catch (err) {
        next(err);
    }
});

module.exports = router;
