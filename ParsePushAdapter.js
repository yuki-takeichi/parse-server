// ParsePushAdapter is the default implementation of
// PushAdapter, it uses GCM for android push and APNS
// for ios push.

var Parse = require('parse/node').Parse,
    GCM = require('./GCM'),
    APNS = require('./APNS');

function ParsePushAdapter() {
 this.validPushTypes = ['ios', 'android'];
 this.senders = {};
}

/**
 * Register push senders
 * @param {Object} pushConfig The push configuration which is given when parse server is initialized
 */
ParsePushAdapter.prototype.registerPushSenders = function(pushConfig) {
  // Initialize senders
  for (var i = 0; i < this.validPushTypes.length; i++) {
    this.senders[this.validPushTypes[i]] = [];
  }

  pushConfig = pushConfig || {};
  var pushTypes = Object.keys(pushConfig);
  for (var i = 0; i < pushTypes.length; i++) {
    var pushType = pushTypes[i];
    if (this.validPushTypes.indexOf(pushType) < 0) {
      throw new Parse.Error(Parse.Error.PUSH_MISCONFIGURED,
                            'Push to ' + pushTypes + ' is not supported');
    }

    var typePushConfig = pushConfig[pushType];
    var senderArgs = [];
    // Since for ios, there maybe multiple cert/key pairs,
    // typePushConfig can be an array.
    if (Array.isArray(typePushConfig)) {
      senderArgs = senderArgs.concat(typePushConfig);
    } else if (typeof typePushConfig === 'object') {
      senderArgs.push(typePushConfig);
    } else {
      throw new Parse.Error(Parse.Error.PUSH_MISCONFIGURED,
                            'Push Configuration is invalid');
    }
    for (var j = 0; j < senderArgs.length; j++) {
      var senderArg = senderArgs[j];
      var sender;
      switch (pushType) {
        case 'ios':
          sender = new APNS(senderArg);
          break;
        case 'android':
          sender = new GCM(senderArg);
          break;
      }
      this.senders[pushType].push(sender);
    }
  }
}

/**
 * Get an array of push senders based on the push type.
 * @param {String} The push type
 * @returns {Array|Undefined} An array of push senders
 */
ParsePushAdapter.prototype.getPushSenders = function(pushType) {
  if (!this.senders[pushType]) {
    console.log('No push sender for push type %s', pushType);
    return [];
  }
  return this.senders[pushType];
}

/**
 * Get an array of valid push types.
 * @returns {Array} An array of valid push types
 */
ParsePushAdapter.prototype.getValidPushTypes = function() {
  return this.validPushTypes;
}

ParsePushAdapter.prototype.send = function(data, installations) {
  var deviceMap = classifyInstallation(installations, this.validPushTypes);
  var sendPromises = [];
  for (var pushType in deviceMap) {
    var senders = this.getPushSenders(pushType);
    // Since ios have dev/prod cert, a push type may have multiple senders
    for (var i = 0; i < senders.length; i++) {
      var sender = senders[i];
      var devices = deviceMap[pushType];
      if (!sender || devices.length == 0) {
        continue;
      }
      // For android, we can only have 1000 recepients per send
      var chunkDevices = sliceDevices(pushType, devices, GCM.GCMRegistrationTokensMax);
      for (var j = 0; j < chunkDevices.length; j++) {
        sendPromises.push(sender.send(data, chunkDevices[j]));
      }
    }
  }
  return Parse.Promise.when(sendPromises);
}

/**
 * Classify the device token of installations based on its device type.
 * @param {Object} installations An array of installations
 * @param {Array} validPushTypes An array of valid push types(string)
 * @returns {Object} A map whose key is device type and value is an array of device
 */
function classifyInstallation(installations, validPushTypes) {
  // Init deviceTokenMap, create a empty array for each valid pushType
  var deviceMap = {};
  for (var i = 0; i < validPushTypes.length; i++) {
    deviceMap[validPushTypes[i]] = [];
  }
  for (var i = 0; i < installations.length; i++) {
    var installation = installations[i];
    // No deviceToken, ignore
    if (!installation.deviceToken) {
      continue;
    }
    var pushType = installation.deviceType;
    if (deviceMap[pushType]) {
      deviceMap[pushType].push({
        deviceToken: installation.deviceToken
      });
    } else {
      console.log('Unknown push type from installation %j', installation);
    }
  }
  return deviceMap;
}

/**
 * Slice a list of devices to several list of devices with fixed chunk size.
 * @param {String} pushType The push type of the given device tokens
 * @param {Array} devices An array of devices
 * @param {Number} chunkSize The size of the a chunk
 * @returns {Array} An array which contaisn several arries of devices with fixed chunk size
 */
function sliceDevices(pushType, devices, chunkSize) {
  if (pushType !== 'android') {
    return [devices];
  }
  var chunkDevices = [];
  while (devices.length > 0) {
    chunkDevices.push(devices.splice(0, chunkSize));
  }
  return chunkDevices;
}

if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  ParsePushAdapter.classifyInstallation = classifyInstallation;
  ParsePushAdapter.sliceDevices = sliceDevices;
}
module.exports = ParsePushAdapter;
