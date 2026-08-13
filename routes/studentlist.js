var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
  res.redirect('/students-list.html');
});

module.exports = router;
