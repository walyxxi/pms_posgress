var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const fileUpload = require('express-fileupload');

var app = express();

const { Pool } = require('pg');

// heroku connect
const pool = new Pool({
  user: 'wiwlmwdrxxmgcj',
  host: 'ec2-23-23-184-76.compute-1.amazonaws.com',
  database: 'ddf249amska09t',
  password: 'cf52743d070905afcdeb7e5c245c238a49ab6a77e41edffad97dfede5a033170',
  port: 5432
})

// local connect
// const pool = new Pool({
//   user: 'postgres',
//   host: 'localhost',
//   database: 'datapms',
//   password: '142592',
//   port: 5432
// })

var loginRouter = require('./routes/login')(pool);
var projectsRouter = require('./routes/projects')(pool);
var profilesRouter = require('./routes/profiles')(pool);
var usersRouter = require('./routes/users')(pool);

// view engine setup
app.use(fileUpload());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'apapun'
}))
app.use(flash());

app.use(function(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
})

app.use('/', loginRouter);
app.use('/projects', projectsRouter);
app.use('/profiles', profilesRouter);
app.use('/users', usersRouter);

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
