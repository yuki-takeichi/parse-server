// Logger
//
// Wrapper around Winston logging library with custom query
// 
// expected log entry to be in the shape of:
// {"level":"info","message":"{ '0': 'Your Message' }","timestamp":"2016-02-04T05:59:27.412Z"}
//
var winston = require('winston');
var fs = require('fs');
var readline = require('readline');
var Parse = require('parse/node').Parse;

var MILLISECONDS_IN_A_DAY = 24 * 60 * 60 * 1000;
var LOGS_FOLDER = './logs/';
var CACHE_TIME = 1000 * 60;

var currentDate = new Date();

var simpleCache = {
  timestamp: null,
  from: null,
  until: null,
  order: null,
  data: []
};

// returns the iso formatted file name
function _getFileName() {
  return _getNearestDay(currentDate).toISOString()
}

// returns Date object rounded to nearest day
function _getNearestDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// returns Date object of previous day
function _getPrevDay(date) {
  return new Date(date - MILLISECONDS_IN_A_DAY);
}

// check for valid cache when both from and util match.
// cache valid for up to 1 minute
function _hasValidCache(from, until) {
  if (String(from) === String(simpleCache.from) &&
    String(until) === String(simpleCache.until) &&
    new Date() - simpleCache.timestamp < CACHE_TIME) {
    return true;
  }
  return false;
}

// check logs folder exists
if (!fs.existsSync(LOGS_FOLDER)) {
  fs.mkdirSync(LOGS_FOLDER);
}

// create logger instance
// winston used for convenience can be changed later on
var _logger = new (winston.Logger)({
  exitOnError: false,
  transports: [
    new (winston.transports.File)({
      filename: LOGS_FOLDER + _getFileName() + '.info',
      name: 'info-file',
      level: 'info'
    }),
    new (winston.transports.File)({
      filename: LOGS_FOLDER + _getFileName() + '.error',
      name: 'error-file',
      level: 'error'
    })
  ]
});

// renews transports to current date
function _renewTransports(logger) {
  _logger.add(winston.transports.File, {
    filename: LOGS_FOLDER + _getFileName() + '.info',
    name: 'info-file',
    level: 'info'
  });
  _logger.add(winston.transports.File, {
    filename: LOGS_FOLDER + _getFileName() + '.error',
    name: 'error-file',
    level: 'error'
  });
}

// ensure that file name is up to date
function _verifyTransports() {
  if (_getNearestDay(currentDate) !== _getNearestDay(new Date())) {
    currentDate = new Date();
    _logger.remove('info-file');
    _logger.remove('error-file');
    _renewTransports();
  }
}

// check that log entry has valid time stamp based on query
function _isValidLogEntry(from, until, entry) {
  var _entry = JSON.parse(entry),
    timestamp = new Date(_entry.timestamp);
  return timestamp >= from && timestamp <= until
    ? true
    : false
}

// exported public methods
function info() {
  _verifyTransports();
  return _logger.info(arguments);
}

function error() {
  _verifyTransports();
  return _logger.error(arguments);
}

// custom query as winston is currently limited
function query(options, callback) {
  if (!options) {
    options = {};
  }
  // defaults to 7 days prior
  var from = options.from || new Date(Date.now() - (7 * MILLISECONDS_IN_A_DAY)),
    until = options.until || new Date(),
    size = options.size || 10,
    order = options.order || 'desc',
    level = options.level || 'info',
    roundedUntil = _getNearestDay(until),
    roundedFrom = _getNearestDay(from);

  if (_hasValidCache(roundedFrom, roundedUntil)) {
    var logs = [];
    if (order !== simpleCache.order) {
      // reverse order of data
      simpleCache.data.forEach((entry) => {
        logs.unshift(entry);
      });
    } else {
      logs = simpleCache.data;
    }
    callback(logs.slice(0, size));
    return;
  }

  var curDate = roundedUntil,
    curSize = 0,
    method = order === 'desc' ? 'push' : 'unshift',
    files = [],
    promises = [];

  // current a batch call, all files with valid dates are read
  while (curDate >= from) {
    files[method](LOGS_FOLDER + curDate.toISOString() + '.' + level);
    curDate = _getPrevDay(curDate);
  }

  // read each file and split based on newline char.
  // limitation is message cannot contain newline
  // TODO: strip out delimiter from logged message
  files.forEach(function(file, i) {
    var promise = new Parse.Promise();
    fs.readFile(file, 'utf8', function(err, data) {
      if (err) {
        promise.resolve([]);
      }  else {
        var results = data.split('\n').filter((value) => {
          return value.trim() !== '';
        });
        promise.resolve(results);
      }
    });
    promises[method](promise);
  });

  Parse.Promise.when(promises).then(function() {
    var logs = [];
    var args = Array.prototype.slice.call(arguments);
    args.forEach(function(logEntries, i) {
      logEntries.forEach(function(entry) {
        if (_isValidLogEntry(from, until, entry)) {
          logs[method](entry);
        }
      });
    });
    simpleCache = {
      timestamp: new Date(),
      from: roundedFrom,
      until: roundedUntil,
      data: logs,
      order: order,
    };
    callback(logs.slice(0, size));
  });
}

module.exports = {
  info: info,
  error: error,
  query: query
};
