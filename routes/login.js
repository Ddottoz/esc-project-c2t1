var express = require('express');
var router = express.Router();
var EducatorModel = require('../models/educator');

/* Show the login page. */
router.get('/', function(req, res, next) {
  res.render('login', {error: '', email: ''});
});

/* Handle the login form.
   Check the email and password against the database. If they match, remember
   who is logged in (in a cookie) and show their profile. If not, show an error. */
router.post('/', async function(req, res, next) {
  try {
    const email = (req.body.email || '').trim();
    const password = req.body.password || '';

    const educator = await EducatorModel.authenticate(email, password);
    if (!educator) {
      return res.render('login', {error: 'Incorrect email or password', email: email});
    }

    res.cookie('educatorId', educator.educatorId);
    res.redirect('/educator');
  } catch (err) {
    next(err);
  }
});

/* Log out: forget who is logged in and go back to the login page. */
router.get('/logout', function(req, res, next) {
  res.clearCookie('educatorId');
  res.redirect('/login');
});

module.exports = router;
