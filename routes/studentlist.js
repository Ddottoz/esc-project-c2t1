var express = require('express');
var router = express.Router();

// TODO: replace with global students list 
router.get('/', function(req, res, next) {
  // The global Students feature is intentionally a placeholder for now.
  res.render('placeholder', {
    pageTitle: 'PLACEHOLDER: Global Students List',
    message: 'placeholder',
    layout: 'standalone',
    activeTop: 'students', 
    todo: 'Implement'
  });
});

module.exports = router;
