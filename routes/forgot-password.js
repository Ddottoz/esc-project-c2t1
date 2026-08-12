var express = require('express');
var router = express.Router();
var EducatorModel = require('../models/educator');

/* Show the forgot password page. */
router.get('/', function(req, res, next) {
  res.render('forgot-password', {error: '', done: false, email: ''});
});

/* Set a new password for the account with this email.
   There is no email sending set up, so the educator resets it here directly. */
router.post('/', async function(req, res, next) {
  try {
    const email = (req.body.email || '').trim();
    const newPassword = req.body.newPassword || '';
    const confirmPassword = req.body.confirmPassword || '';

    if (!email || !newPassword) {
      return res.render('forgot-password', {error: 'Email and new password are required', done: false, email: email});
    }
    if (newPassword.length < 8) {
      return res.render('forgot-password', {error: 'Password must be at least 8 characters', done: false, email: email});
    }
    if (newPassword !== confirmPassword) {
      return res.render('forgot-password', {error: 'Passwords do not match', done: false, email: email});
    }

    const educator = await EducatorModel.getEducatorByEmail(email);
    if (!educator) {
      return res.render('forgot-password', {error: 'No account found with that email', done: false, email: email});
    }

    await EducatorModel.updatePassword(educator.educatorId, newPassword);
    res.render('forgot-password', {error: '', done: true, email: email});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
