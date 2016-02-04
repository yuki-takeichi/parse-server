// These methods handle the 'logs' route.
// Methods of the form 'handleX' return promises and are intended to
// be used with the PromiseRouter.

var Parse = require('parse/node').Parse,
    PromiseRouter = require('./PromiseRouter'),
    Promise = Parse.Promise,
    LoggerAdapter = require('./LoggerAdapter');

var router = new PromiseRouter();

var INFO = 'INFO';
var ERROR = 'ERROR';
var MILLISECONDS_IN_A_DAY = 24 * 60 * 60 * 1000;

// only allow request with master key
function enforceSecurity(auth) {
  if (!auth || !auth.isMaster) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Clients aren\'t allowed to perform the ' +
      method + ' operation on logs.'
    );
  }
}

// check that date input is valid
function isValidDateTime(date) {
  if (!date || isNaN(Number(date))) {
    return false;
  }
}

// Returns a promise for a {response} object.
// query params:
// from (optional) Start time for the search. Defaults to 1 week ago.
// until (optional) End time for the search. Defaults to current time.
// order (optional) Direction of results returned, either “asc” or “desc”. Defaults to “desc”.
// size (optional) Number of rows returned by search. Defaults to 10
function handleGet(req) {
  var promise = new Parse.Promise();
  var from = (isValidDateTime(req.query.from) && new Date(req.query.from)) ||
    new Date(Date.now() - 7 * MILLISECONDS_IN_A_DAY);
  var until = (isValidDateTime(req.query.until) && new Date(req.query.until)) || new Date();
  var size = Number(req.query.size) || 10;
  var order = req.query.order || 'desc';
  var level = req.query.level || INFO;
  enforceSecurity(req.auth);
  LoggerAdapter.getAdapter().query({
    from: from,
    until: until,
    size: size,
    order: order,
    level: level
  }, function(result) {
    promise.resolve({
      response: result
    });
  });
  return promise;
}

router.route('GET', '/logs', handleGet);

module.exports = router;

