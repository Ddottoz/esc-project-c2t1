var express = require('express');
var router = express.Router();
var EducatorModel = require('../models/educator');
var {setAuthCookie} = require('../middleware/auth');

/* Show the register page. */
router.get('/', function(req, res, next) {
  res.render('register', {error: '', name: '', email: ''});
});

/* Create the new educator account. */
router.post('/', async function(req, res, next) {
  try {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim();
    const password = req.body.password || '';
    const confirmPassword = req.body.confirmPassword || '';

    const error = EducatorModel.checkSignUpForm(name, email, password, confirmPassword);
    if (error) {
      return res.render('register', {error: error, name: name, email: email});
    }
    if (await EducatorModel.emailExists(email)) {
      return res.render('register', {error: 'An account with this email already exists', name: name, email: email});
    }

    const educatorId = await EducatorModel.createEducator(name, email, password);

    // Log the new educator straight in and show their profile.
    setAuthCookie(res, educatorId);
    res.redirect('/educator');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
