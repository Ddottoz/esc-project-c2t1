var express = require('express');
var router = express.Router();

/* Show the register page. */
router.get('/', function(req, res, next) {
  res.render('register');
});

/* Handle the sign-up form.
   There is no real account creation yet (see UC5), so for now we just
   send the user to the login page. Replace this with real account
   creation once auth is built. */
router.post('/', function(req, res, next) {
  res.redirect('/login');
});

module.exports = router;
