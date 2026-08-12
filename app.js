require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
require('dotenv').config();

var studentListRouter = require('./routes/studentlist'); // placeholder for global student list
var studentRouter = require('./routes/student');
var lookupsRouter = require('./routes/lookups');
var educatorStudentRouter = require('./routes/educator-student')
var indexRouter = require('./routes/index');
var loginRouter = require('./routes/login');
var registerRouter = require("./routes/register");
var reportRouter = require("./routes/report")
var assessmentRouter = require('./routes/assessment');
var bandsRouter = require('./routes/bands');
var uploadRouter = require('./routes/upload');
var viewAnalysisRouter = require("./routes/viewAnalysisRoutes");
var submissionRouter = require("./routes/submissionRoutes");
var educatorRouter = require('./routes/educator');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/login', loginRouter);
app.use('/students', studentListRouter); // placeholder for global student list 
app.use('/api/students', studentRouter);
app.use('/api', lookupsRouter);
app.use('/api/educators', educatorStudentRouter);
app.use('/register/', registerRouter);
app.use('/reports', reportRouter);
app.use('/assessments/', assessmentRouter);
app.use('/bands', bandsRouter);
app.use('/upload', uploadRouter);
app.use('/public/uploads', express.static('public/uploads'));
app.use("/viewanalysis", viewAnalysisRouter);
app.use("/submission", submissionRouter);
app.use('/educator', educatorRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
