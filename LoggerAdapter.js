// Logger Adapter
//
// Allows you to change the logger mechanism
//
// Adapter classes must implement the following functions:
// * info(obj1 [, obj2, .., objN])
// * error(obj1 [, obj2, .., objN])
// * query(options, callback)
// Default is Logger.js

var Logger = require('./Logger');

var adapter = Logger;

function setAdapter(loggerAdapter) {
  adapter = loggerAdapter;
}

function getAdapter() {
  return adapter;
}

module.exports = {
  getAdapter: getAdapter,
  setAdapter: setAdapter
};
