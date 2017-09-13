'use strict';
const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');
let noble;
const util = require('util');
// Local imports
const OpenBCIUtilities = require('openbci-utilities');
const obciUtils = OpenBCIUtilities.Utilities;
const k = OpenBCIUtilities.Constants;
const obciDebug = OpenBCIUtilities.Debug;
const clone = require('clone');

/**
 * @typedef {Object} InitializationObject Board optional configurations.
 * @property {Boolean} debug Print out a raw dump of bytes sent and received. (Default `false`)
 *
 * @property {Boolean} nobleAutoStart Automatically initialize `noble`. Subscribes to blue tooth state changes and such.
 *           (Default `true`)
 *
 * @property {Boolean} nobleScanOnPowerOn Start scanning for CytonBLE BLE devices as soon as power turns on.
 *           (Default `true`)
 *
 * @property {Boolean} sendCounts Send integer raw counts instead of scaled floats.
 *           (Default `false`)
 *
 * @property {Boolean} - Print out useful debugging events. (Default `false`)
 */

/**
 * Options object
 * @type {InitializationObject}
 * @private
 */
const _options = {
  debug: false,
  nobleAutoStart: true,
  nobleScanOnPowerOn: true,
  sendCounts: false,
  verbose: false
};

/**
 * @description The initialization method to call first, before any other method.
 * @param options {InitializationObject} (optional) - Board optional configurations.
 * @param callback {function} (optional) - A callback function used to determine if the noble module was able to be started.
 *    This can be very useful on Windows when there is no compatible BLE device found.
 * @constructor
 * @author AJ Keller (@pushtheworldllc)
 */
function CytonBLE (options, callback) {
  if (!(this instanceof CytonBLE)) {
    return new CytonBLE(options, callback);
  }

  if (options instanceof Function) {
    callback = options;
    options = {};
  }

  options = (typeof options !== 'function') && options || {};
  let opts = {};

  /** Configuring Options */
  let o;
  for (o in _options) {
    let userOption = (o in options) ? o : o.toLowerCase();
    let userValue = options[userOption];
    delete options[userOption];

    if (typeof _options[o] === 'object') {
      // an array specifying a list of choices
      // if the choice is not in the list, the first one is defaulted to

      if (_options[o].indexOf(userValue) !== -1) {
        opts[o] = userValue;
      } else {
        opts[o] = _options[o][0];
      }
    } else {
      // anything else takes the user value if provided, otherwise is a default

      if (userValue !== undefined) {
        opts[o] = userValue;
      } else {
        opts[o] = _options[o];
      }
    }
  }

  for (o in options) throw new Error('"' + o + '" is not a valid option');

  // Set to global options object
  /**
   * @type {InitializationObject}
   */
  this.options = clone(opts);

  /** Private Properties (keep alphabetical) */
  this._accelArray = [0, 0, 0];
  this._connected = false;
  this._localName = null;
  this._multiPacketBuffer = null;
  this._packetCounter = 0;
  this._peripheral = null;
  this._rawDataPacketToSample = k.rawDataToSampleObjectDefault(k.numberOfChannelsForBoardType(k.OBCIBoardCytonBLE));
  this._rawDataPacketToSample.scale = !this.options.sendCounts;
  this._rawDataPacketToSample.protocol = k.OBCIProtocolBLE;
  this._rawDataPacketToSample.verbose = this.options.verbose;
  this._rfduinoService = null;
  this._receiveCharacteristic = null;
  this._scanning = false;
  this._sendCharacteristic = null;
  this._streaming = false;

  /** Public Properties (keep alphabetical) */
  this.impedanceTest = obciUtils.impedanceTestObjDefault();
  this.impedanceArray = obciUtils.impedanceArray(k.numberOfChannelsForBoardType(k.OBCIBoardCytonBLE));
  this.cytonBLEPeripheralArray = [];
  this.manualDisconnect = false;
  this.peripheralArray = [];
  this.previousPeripheralArray = [];
  this.previousSampleNumber = -1;
  this.sampleCount = 0;

  try {
    noble = require('noble');
    if (this.options.nobleAutoStart) this._nobleInit(); // It get's the noble going
    if (callback) callback();
  } catch (e) {
    if (callback) callback(e);
  }
}

// This allows us to use the emitter class freely outside of the module
util.inherits(CytonBLE, EventEmitter);

/**
 * Used to start a scan if power is on. Useful if a connection is dropped.
 */
CytonBLE.prototype.autoReconnect = function () {
  // TODO: send back reconnect status, or reconnect fail
  if (noble.state === k.OBCINobleStatePoweredOn) {
    this._nobleScanStart();
  } else {
    console.warn('BLE not AVAILABLE');
  }
};

/**
 * @description Send a command to the board to turn a specified channel off
 * @param channelNumber
 * @returns {Promise.<T>}
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype.channelOff = function (channelNumber) {
  return k.commandChannelOff(channelNumber).then((charCommand) => {
    return this.write(charCommand);
  });
};

/**
 * @description Send a command to the board to turn a specified channel on
 * @param channelNumber
 * @returns {Promise.<T>|*}
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype.channelOn = function (channelNumber) {
  return k.commandChannelOn(channelNumber).then((charCommand) => {
    return this.write(charCommand);
  });
};

/**
 * @description The essential precursor method to be called initially to establish a
 *              ble connection to the OpenBCI ganglion board.
 * @param id {String | Object} - a string local name or peripheral object
 * @returns {Promise} If the board was able to connect.
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype.connect = function (id) {
  return new Promise((resolve, reject) => {
    if (_.isString(id)) {
      k.getPeripheralWithLocalName(this.cytonBLEPeripheralArray, id)
        .then((p) => {
          return this._nobleConnect(p);
        })
        .then(resolve)
        .catch(reject);
    } else if (_.isObject(id)) {
      this._nobleConnect(id)
        .then(resolve)
        .catch(reject);
    } else {
      reject(k.OBCIErrorInvalidByteLength);
    }
  });
};

/**
 * Destroys the noble!
 */
CytonBLE.prototype.destroyNoble = function () {
  this._nobleDestroy();
};

/**
 * Destroys the multi packet buffer.
 */
CytonBLE.prototype.destroyMultiPacketBuffer = function () {
  this._multiPacketBuffer = null;
};

/**
 * @description Closes the connection to the board. Waits for stop streaming command to
 *  be sent if currently streaming.
 * @param stopStreaming {Boolean} (optional) - True if you want to stop streaming before disconnecting.
 * @returns {Promise} - fulfilled by a successful close, rejected otherwise.
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype.disconnect = function (stopStreaming) {
  // no need for timeout here; streamStop already performs a delay
  return Promise.resolve()
    .then(() => {
      if (stopStreaming) {
        if (this.isStreaming()) {
          if (this.options.verbose) console.log('stop streaming');
          return this.streamStop();
        }
      }
      return Promise.resolve();
    })
    .then(() => {
      return new Promise((resolve, reject) => {
        // serial emitting 'close' will call _disconnected
        if (this._peripheral) {
          this._peripheral.disconnect((err) => {
            if (err) {
              this._disconnected();
              reject(err);
            } else {
              this._disconnected();
              resolve();
            }
          });
        } else {
          reject('no peripheral to disconnect');
        }
      });
    });
};

/**
 * Return the local name of the attached CytonBLE device.
 * @return {null|String}
 */
CytonBLE.prototype.getLocalName = function () {
  return this._localName;
};

/**
 * Get's the multi packet buffer.
 * @return {null|Buffer} - Can be null if no multi packets received.
 */
CytonBLE.prototype.getMutliPacketBuffer = function () {
  return this._multiPacketBuffer;
};

/**
 * @description Run a complete impedance test on a single channel, applying the test signal individually to P & N inputs.
 * @param channelNumber - A Number, specifies which channel you want to test.
 * @returns {Promise} - Fulfilled with a single channel impedance object.
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype.impedanceTestChannel = function (channelNumber) {
  this.impedanceArray[channelNumber - 1] = obciUtils.impedanceObject(channelNumber);
  return new Promise((resolve, reject) => {
    this._impedanceTestSetChannel(channelNumber, true, false) // Sends command for P input on channel number.
      .then(channelNumber => {
        return this._impedanceTestCalculateChannel(channelNumber, true, false); // Calculates for P input of channel number
      })
      .then(channelNumber => {
        return this._impedanceTestSetChannel(channelNumber, false, true); // Sends command for N input on channel number.
      })
      .then(channelNumber => {
        return this._impedanceTestCalculateChannel(channelNumber, false, true); // Calculates for N input of channel number
      })
      .then(channelNumber => {
        return this._impedanceTestSetChannel(channelNumber, false, false); // Sends command to stop applying test signal to P and N channel
      })
      .then(channelNumber => {
        return this._impedanceTestFinalizeChannel(channelNumber, true, true); // Finalize the impedances.
      })
      .then((channelNumber) => resolve(this.impedanceArray[channelNumber - 1]))
      .catch(err => reject(err));
  });
};

/**
 * @description Run impedance test on a single channel, applying the test signal only to P input.
 * @param channelNumber - A Number, specifies which channel you want to test.
 * @returns {Promise} - Fulfilled with a single channel impedance object.
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype.impedanceTestChannelInputP = function (channelNumber) {
  this.impedanceArray[channelNumber - 1] = obciUtils.impedanceObject(channelNumber);
  return new Promise((resolve, reject) => {
    this._impedanceTestSetChannel(channelNumber, true, false) // Sends command for P input on channel number.
      .then(channelNumber => {
        return this._impedanceTestCalculateChannel(channelNumber, true, false); // Calculates for P input of channel number
      })
      .then(channelNumber => {
        return this._impedanceTestSetChannel(channelNumber, false, false); // Sends command to stop applying test signal to P and N channel
      })
      .then(channelNumber => {
        return this._impedanceTestFinalizeChannel(channelNumber, true, false); // Finalize the impedances.
      })
      .then((channelNumber) => resolve(this.impedanceArray[channelNumber - 1]))
      .catch(err => reject(err));
  });
};

/**
 * @description Run impedance test on a single channel, applying the test signal to N input.
 * @param channelNumber - A Number, specifies which channel you want to test.
 * @returns {Promise} - Fulfilled with a single channel impedance object.
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype.impedanceTestChannelInputN = function (channelNumber) {
  this.impedanceArray[channelNumber - 1] = obciUtils.impedanceObject(channelNumber);
  return new Promise((resolve, reject) => {
    this._impedanceTestSetChannel(channelNumber, false, true) // Sends command for N input on channel number.
      .then(channelNumber => {
        return this._impedanceTestCalculateChannel(channelNumber, false, true); // Calculates for N input of channel number
      })
      .then(channelNumber => {
        return this._impedanceTestSetChannel(channelNumber, false, false); // Sends command to stop applying test signal to P and N channel
      })
      .then(channelNumber => {
        return this._impedanceTestFinalizeChannel(channelNumber, false, true); // Finalize the impedances.
      })
      .then((channelNumber) => resolve(this.impedanceArray[channelNumber - 1]))
      .catch(err => reject(err));
  });
};

/* istanbul ignore next */
/**
 * @description To apply the impedance test signal to an input for any given channel
 * @param channelNumber -  Number - The channel you want to test.
 * @param pInput - A bool true if you want to apply the test signal to the P input, false to not apply the test signal.
 * @param nInput - A bool true if you want to apply the test signal to the N input, false to not apply the test signal.
 * @returns {Promise} - With Number value of channel number
 * @private
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype._impedanceTestSetChannel = function (channelNumber, pInput, nInput) {
  return new Promise((resolve, reject) => {
    if (!this.isConnected()) return reject(Error('Must be connected'));

    /* istanbul ignore if */
    if (this.options.verbose) {
      if (pInput && !nInput) {
        console.log('\tSending command to apply test signal to P input.');
      } else if (!pInput && nInput) {
        console.log('\tSending command to apply test signal to N input.');
      } else if (pInput && nInput) {
        console.log('\tSending command to apply test signal to P and N inputs.');
      } else {
        console.log('\tSending command to stop applying test signal to both P and N inputs.');
      }
    }

    if (!pInput && !nInput) {
      this.impedanceTest.active = false; // Critical to changing the flow of `._processBytes()`
      // this.writeOutDelay = k.OBCIWriteIntervalDelayMSShort
    } else {
      // this.writeOutDelay = k.OBCIWriteIntervalDelayMSLong
    }
    if (this.options.verbose) console.log('pInput: ' + pInput + ' nInput: ' + nInput);
    // Get impedance settings to send the board
    k.getImpedanceSetter(channelNumber, pInput, nInput).then((commandsArray) => {
      return this.write(commandsArray);
    }).then(() => {
      /**
       * If either pInput or nInput are true then we should start calculating impedance. Setting
       *  this.impedanceTest.active to true here allows us to route every sample for an impedance
       *  calculation instead of the normal sample output.
       */
      if (pInput || nInput) this.impedanceTest.active = true;
      resolve(channelNumber);
    }, (err) => {
      reject(err);
    });
  });
};

/**
 * @description Calculates the impedance for a specified channel for a set time
 * @param channelNumber - A Number, the channel number you want to test.
 * @param pInput - A bool true if you want to calculate impedance on the P input, false to not calculate.
 * @param nInput - A bool true if you want to calculate impedance on the N input, false to not calculate.
 * @returns {Promise} - Resolves channelNumber as value on fulfill, rejects with error...
 * @private
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype._impedanceTestCalculateChannel = function (channelNumber, pInput, nInput) {
  /* istanbul ignore if */
  if (this.options.verbose) {
    if (pInput && !nInput) {
      console.log('\tCalculating impedance for P input.');
    } else if (!pInput && nInput) {
      console.log('\tCalculating impedance for N input.');
    } else if (pInput && nInput) {
      console.log('\tCalculating impedance for P and N input.');
    } else {
      console.log('\tNot calculating impedance for either P and N input.');
    }
  }
  return new Promise((resolve, reject) => {
    if (channelNumber < 1 || channelNumber > this.numberOfChannels()) return reject(Error('Invalid channel number'));
    if (typeof pInput !== 'boolean') return reject(Error("Invalid Input: 'pInput' must be of type Bool"));
    if (typeof nInput !== 'boolean') return reject(Error("Invalid Input: 'nInput' must be of type Bool"));
    this.impedanceTest.onChannel = channelNumber;
    this.impedanceTest.sampleNumber = 0; // Reset the sample number
    this.impedanceTest.isTestingPInput = pInput;
    this.impedanceTest.isTestingNInput = nInput;
    // console.log(channelNumber + ' In calculate channel pInput: ' + pInput + ' this.impedanceTest.isTestingPInput: ' + this.impedanceTest.isTestingPInput)
    // console.log(channelNumber + ' In calculate channel nInput: ' + nInput + ' this.impedanceTest.isTestingNInput: ' + this.impedanceTest.isTestingNInput)
    setTimeout(() => { // Calculate for 250ms
      this.impedanceTest.onChannel = 0;
      /* istanbul ignore if */
      if (this.options.verbose) {
        if (pInput && !nInput) {
          console.log('\tDone calculating impedance for P input.');
        } else if (!pInput && nInput) {
          console.log('\tDone calculating impedance for N input.');
        } else if (pInput && nInput) {
          console.log('\tDone calculating impedance for P and N input.');
        } else {
          console.log('\tNot calculating impedance for either P and N input.');
        }
      }
      if (pInput) this.impedanceArray[channelNumber - 1].P.raw = this.impedanceTest.impedanceForChannel;
      if (nInput) this.impedanceArray[channelNumber - 1].N.raw = this.impedanceTest.impedanceForChannel;
      resolve(channelNumber);
    }, 400);
  });
};

/**
 * @description Calculates average and gets textual value of impedance for a specified channel
 * @param channelNumber - A Number, the channel number you want to finalize.
 * @param pInput - A bool true if you want to finalize impedance on the P input, false to not finalize.
 * @param nInput - A bool true if you want to finalize impedance on the N input, false to not finalize.
 * @returns {Promise} - Resolves channelNumber as value on fulfill, rejects with error...
 * @private
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype._impedanceTestFinalizeChannel = function (channelNumber, pInput, nInput) {
  /* istanbul ignore if */
  if (this.options.verbose) {
    if (pInput && !nInput) {
      console.log('\tFinalizing impedance for P input.');
    } else if (!pInput && nInput) {
      console.log('\tFinalizing impedance for N input.');
    } else if (pInput && nInput) {
      console.log('\tFinalizing impedance for P and N input.');
    } else {
      console.log('\tNot Finalizing impedance for either P and N input.');
    }
  }
  return new Promise((resolve, reject) => {
    if (channelNumber < 1 || channelNumber > this.numberOfChannels()) return reject(Error('Invalid channel number'));
    if (typeof pInput !== 'boolean') return reject(Error("Invalid Input: 'pInput' must be of type Bool"));
    if (typeof nInput !== 'boolean') return reject(Error("Invalid Input: 'nInput' must be of type Bool"));

    if (pInput) obciUtils.impedanceSummarize(this.impedanceArray[channelNumber - 1].P);
    if (nInput) obciUtils.impedanceSummarize(this.impedanceArray[channelNumber - 1].N);

    setTimeout(() => {
      resolve(channelNumber);
    }, 50); // Introduce a delay to allow for extra time in case of back to back tests
  });
};

/**
 * @description To test specific input configurations of channels!
 * @param arrayOfChannels - The array of configurations where:
 *              'p' or 'P' is only test P input
 *              'n' or 'N' is only test N input
 *              'b' or 'B' is test both inputs (takes 66% longer to run)
 *              '-' to ignore channel
 *      EXAMPLE:
 *          For 8 channel board: ['-','N','n','p','P','-','b','b']
 *              (Note: it doesn't matter if capitalized or not)
 * @returns {Promise} - Fulfilled with a loaded impedance object.
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype.impedanceTestChannels = function (arrayOfChannels) {
  if (!Array.isArray(arrayOfChannels)) return Promise.reject(Error('Input must be array of channels... See Docs!'));
  if (!this.isStreaming()) return Promise.reject(Error('Must be streaming!'));
  // Check proper length of array
  if (arrayOfChannels.length !== this.numberOfChannels()) return Promise.reject(Error('Array length mismatch, should have ' + this.numberOfChannels() + ' but array has length ' + arrayOfChannels.length));

  // Recursive function call
  let completeChannelImpedanceTest = (channelNumber) => {
    return new Promise((resolve, reject) => {
      if (channelNumber > arrayOfChannels.length) { // Base case!
        this.emit('impedanceArray', this.impedanceArray);
        this.impedanceTest.onChannel = 0;
        resolve();
      } else {
        if (this.options.verbose) console.log('\n\nImpedance Test for channel ' + channelNumber);

        let testCommand = arrayOfChannels[channelNumber - 1];

        if (testCommand === 'p' || testCommand === 'P') {
          this.impedanceTestChannelInputP(channelNumber).then(() => {
            completeChannelImpedanceTest(channelNumber + 1).then(resolve, reject);
          }).catch(err => reject(err));
        } else if (testCommand === 'n' || testCommand === 'N') {
          this.impedanceTestChannelInputN(channelNumber).then(() => {
            completeChannelImpedanceTest(channelNumber + 1).then(resolve, reject);
          }).catch(err => reject(err));
        } else if (testCommand === 'b' || testCommand === 'B') {
          this.impedanceTestChannel(channelNumber).then(() => {
            completeChannelImpedanceTest(channelNumber + 1).then(resolve, reject);
          }).catch(err => reject(err));
        } else { // skip ('-') condition
          completeChannelImpedanceTest(channelNumber + 1).then(resolve, reject);
        }
      }
    });
  };
  return completeChannelImpedanceTest(1);
};

/**
 * @description Checks if the driver is connected to a board.
 * @returns {boolean} - True if connected.
 */
CytonBLE.prototype.isConnected = function () {
  return this._connected;
};

/**
 * @description Checks if bluetooth is powered on.
 * @returns {boolean} - True if bluetooth is powered on.
 */
CytonBLE.prototype.isNobleReady = function () {
  return this._nobleReady();
};

/**
 * @description Checks if noble is currently scanning.
 * @returns {boolean} - True if streaming.
 */
CytonBLE.prototype.isSearching = function () {
  return this._scanning;
};

/**
 * @description Checks if the board is currently sending samples.
 * @returns {boolean} - True if streaming.
 */
CytonBLE.prototype.isStreaming = function () {
  return this._streaming;
};

/**
 * @description This function is used as a convenience method to determine how many
 *              channels the current board is using.
 * @returns {Number} A number
 * Note: This is dependent on if you configured the board correctly on setup options
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype.numberOfChannels = function () {
  return k.OBCINumberOfChannelsCytonBLE;
};

/**
 * @description Get the the current sample rate is.
 * @returns {Number} The sample rate
 * Note: This is dependent on if you configured the board correctly on setup options
 */
CytonBLE.prototype.sampleRate = function () {
  if (this.options.simulate) {
    return this.options.simulatorSampleRate;
  } else {
    return k.OBCISampleRate250;
  }
};

/**
 * @description List available peripherals so the user can choose a device when not
 *              automatically found.
 * @param `maxSearchTime` {Number} - The amount of time to spend searching. (Default is 20 seconds)
 * @returns {Promise} - If scan was started
 */
CytonBLE.prototype.searchStart = function (maxSearchTime) {
  const searchTime = maxSearchTime || k.OBCIGanglionBleSearchTime;

  return new Promise((resolve, reject) => {
    this._searchTimeout = setTimeout(() => {
      this._nobleScanStop().catch(reject);
      reject('Timeout: Unable to find CytonBLE');
    }, searchTime);

    this._nobleScanStart()
      .then(() => {
        resolve();
      })
      .catch((err) => {
        if (err !== k.OBCIErrorNobleAlreadyScanning) { // If it's already scanning
          clearTimeout(this._searchTimeout);
          reject(err);
        }
      });
  });
};

/**
 * Called to end a search.
 * @return {global.Promise|Promise}
 */
CytonBLE.prototype.searchStop = function () {
  return this._nobleScanStop();
};

/**
 * @description Sends a soft reset command to the board
 * @returns {Promise} - Fulfilled if the command was sent to board.
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype.softReset = function () {
  return this.write(k.OBCIMiscSoftReset);
};

/**
 * @description Sends a start streaming command to the board.
 * @returns {Promise} indicating if the signal was able to be sent.
 * Note: You must have successfully connected to an OpenBCI board using the connect
 *           method. Just because the signal was able to be sent to the board, does not
 *           mean the board will start streaming.
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype.streamStart = function () {
  return new Promise((resolve, reject) => {
    if (this.isStreaming()) return reject('Error [.streamStart()]: Already streaming');
    this._streaming = true;
    this.write(k.OBCIStreamStart)
      .then(() => {
        if (this.options.verbose) console.log('Sent stream start to board.');
        resolve();
      })
      .catch(reject);
  });
};

/**
 * @description Sends a stop streaming command to the board.
 * @returns {Promise} indicating if the signal was able to be sent.
 * Note: You must have successfully connected to an OpenBCI board using the connect
 *           method. Just because the signal was able to be sent to the board, does not
 *           mean the board stopped streaming.
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype.streamStop = function () {
  return new Promise((resolve, reject) => {
    if (!this.isStreaming()) return reject('Error [.streamStop()]: No stream to stop');
    this._streaming = false;
    this.write(k.OBCIStreamStop)
      .then(() => {
        resolve();
      })
      .catch(reject);
  });
};

/**
 * @description Used to send data to the board.
 * @param data {Array | Buffer | Buffer2 | Number | String} - The data to write out
 * @returns {Promise} - fulfilled if command was able to be sent
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype.write = function (data) {
  return new Promise((resolve, reject) => {
    if (this._sendCharacteristic) {
      if (!Buffer.isBuffer(data)) {
        data = new Buffer(data);
      }
      this._sendCharacteristic.write(data, true, (err) => {
        if (err) {
          reject(err);
        } else {
          if (this.options.debug) obciDebug.debugBytes('>>>', data);
          resolve();
        }
      });
    } else {
      reject('Send characteristic not set, please call connect method');
    }
  });
};

// //////// //
// PRIVATES //
// //////// //


/**
 * @description Called once when for any reason the ble connection is no longer open.
 * @private
 */
CytonBLE.prototype._disconnected = function () {
  this._streaming = false;
  this._connected = false;

  // Clean up _noble
  // TODO: Figure out how to fire function on process ending from inside module
  // noble.removeListener('discover', this._nobleOnDeviceDiscoveredCallback);

  if (this._receiveCharacteristic) {
    this._receiveCharacteristic.removeAllListeners(k.OBCINobleEmitterServiceRead);
  }

  this._receiveCharacteristic = null;

  if (this._rfduinoService) {
    this._rfduinoService.removeAllListeners(k.OBCINobleEmitterServiceCharacteristicsDiscover);
  }

  this._rfduinoService = null;

  if (this._peripheral) {
    this._peripheral.removeAllListeners(k.OBCINobleEmitterPeripheralConnect);
    this._peripheral.removeAllListeners(k.OBCINobleEmitterPeripheralDisconnect);
    this._peripheral.removeAllListeners(k.OBCINobleEmitterPeripheralServicesDiscover);
  }

  this._peripheral = null;

  if (!this.manualDisconnect) {
    // this.autoReconnect();
  }

  if (this.options.verbose) console.log(`Private disconnect clean up`);

  this.emit('close');
};

/**
 * Call to destroy the noble event emitters.
 * @private
 */
CytonBLE.prototype._nobleDestroy = function () {
  if (noble)  {
    noble.removeAllListeners(k.OBCINobleEmitterStateChange);
    noble.removeAllListeners(k.OBCINobleEmitterDiscover);
  }
};

CytonBLE.prototype._nobleConnect = function (peripheral) {
  return new Promise((resolve, reject) => {
    if (this.isConnected()) return reject('already connected!');

    this._peripheral = peripheral;
    this._localName = peripheral.advertisement.localName;
    // if (_.contains(_peripheral.advertisement.localName, rfduino.localNamePrefix)) {
    // TODO: slice first 8 of localName and see if that is ganglion
    // here is where we can capture the advertisement data from the rfduino and check to make sure its ours
    if (this.options.verbose) console.log('Device is advertising \'' + this._peripheral.advertisement.localName + '\' service.');
    // TODO: filter based on advertising name ie make sure we are looking for the right thing
    // if (this.options.verbose) console.log("serviceUUID: " + this._peripheral.advertisement.serviceUuids);

    this._peripheral.on(k.OBCINobleEmitterPeripheralConnect, () => {
      // if (this.options.verbose) console.log("got connect event");
      this._peripheral.discoverServices();
      if (this.isSearching()) this._nobleScanStop();
    });

    this._peripheral.on(k.OBCINobleEmitterPeripheralDisconnect, () => {
      if (this.options.verbose) console.log('Peripheral disconnected');
      this._disconnected();
    });

    this._peripheral.on(k.OBCINobleEmitterPeripheralServicesDiscover, (services) => {

      for (let i = 0; i < services.length; i++) {
        if (services[i].uuid === k.RFduinoUuidService) {
          this._rfduinoService = services[i];
          // if (this.options.verbose) console.log("Found rfduino Service");
          break;
        }
      }

      if (!this._rfduinoService) {
        reject('Couldn\'t find the rfduino service.');
      }

      this._rfduinoService.once(k.OBCINobleEmitterServiceCharacteristicsDiscover, (characteristics) => {
        if (this.options.verbose) console.log('Discovered ' + characteristics.length + ' service characteristics');
        for (let i = 0; i < characteristics.length; i++) {
          // console.log(characteristics[i].uuid);
          if (characteristics[i].uuid === k.RFduinoUuidReceive) {
            if (this.options.verbose) console.log("Found receiveCharacteristicUUID");
            this._receiveCharacteristic = characteristics[i];
          }
          if (characteristics[i].uuid === k.RFduinoUuidSend) {
            if (this.options.verbose) console.log("Found sendCharacteristicUUID");
            this._sendCharacteristic = characteristics[i];
          }
        }

        if (this._receiveCharacteristic && this._sendCharacteristic) {
          this._receiveCharacteristic.on(k.OBCINobleEmitterServiceRead, (data) => {
            // TODO: handle all the data, both streaming and not
            this._processBytes(data);
          });

          // if (this.options.verbose) console.log('Subscribing for data notifications');
          this._receiveCharacteristic.notify(true);

          this._connected = true;
          this.emit(k.OBCIEmitterReady);
          resolve();
        } else {
          reject('unable to set both receive and send characteristics!');
        }
      });

      this._rfduinoService.discoverCharacteristics();
    });

    // if (this.options.verbose) console.log("Calling connect");

    this._peripheral.connect((err) => {
      if (err) {
        if (this.options.verbose) console.log(`Unable to connect with error: ${err}`);
        this._disconnected();
        reject(err);
      }
    });
  });
};

/**
 * Call to add the noble event listeners.
 * @private
 */
CytonBLE.prototype._nobleInit = function () {
  noble.on(k.OBCINobleEmitterStateChange, (state) => {
    // TODO: send state change error to gui

    // If the peripheral array is empty, do a scan to fill it.
    if (state === k.OBCINobleStatePoweredOn) {
      if (this.options.verbose) console.log('Bluetooth powered on');
      this.emit(k.OBCIEmitterBlePoweredUp);
      if (this.options.nobleScanOnPowerOn) {
        this._nobleScanStart().catch((err) => {
          console.log(err);
        });
      }
      if (this.peripheralArray.length === 0) {
      }
    } else {
      if (this.isSearching()) {
        this._nobleScanStop().catch((err) => {
          console.log(err);
        });
      }
    }
  });

  noble.on(k.OBCINobleEmitterDiscover, this._nobleOnDeviceDiscoveredCallback.bind(this));
};

/**
 * Event driven function called when a new device is discovered while scanning.
 * @param peripheral {Object} Peripheral object from noble.
 * @private
 */
CytonBLE.prototype._nobleOnDeviceDiscoveredCallback = function (peripheral) {
  if(this.options.verbose) console.log(peripheral.advertisement);
  this.peripheralArray.push(peripheral);
  if (peripheral.advertisement.localName.match(/RFduino/)) {
    if (this.options.verbose) console.log('Found rfduino!');
    if (_.isUndefined(_.find(this.cytonBLEPeripheralArray,
        (p) => {
          return p.advertisement.localName === peripheral.advertisement.localName;
        }))) {
      this.cytonBLEPeripheralArray.push(peripheral);
    }
    this.emit(k.OBCIEmitterRFduino, peripheral);
  }
};

CytonBLE.prototype._nobleReady = function () {
  return noble.state === k.OBCINobleStatePoweredOn;
};

/**
 * Call to perform a scan to get a list of peripherals.
 * @returns {global.Promise|Promise}
 * @private
 */
CytonBLE.prototype._nobleScanStart = function () {
  return new Promise((resolve, reject) => {
    if (this.isSearching()) return reject(k.OBCIErrorNobleAlreadyScanning);
    if (!this._nobleReady()) return reject(k.OBCIErrorNobleNotInPoweredOnState);

    this.peripheralArray = [];
    noble.once(k.OBCINobleEmitterScanStart, () => {
      if (this.options.verbose) console.log('Scan started');
      this._scanning = true;
      this.emit(k.OBCINobleEmitterScanStart);
      resolve();
    });
    // Only look so rfduino ble devices and allow duplicates (multiple ganglions)
    noble.startScanning([], false);
  });
};

/**
 * Stop an active scan
 * @return {global.Promise|Promise}
 * @private
 */
CytonBLE.prototype._nobleScanStop = function () {
  return new Promise((resolve, reject) => {
    if (!this.isSearching()) return reject(k.OBCIErrorNobleNotAlreadyScanning);
    if (this.options.verbose) console.log(`Stopping scan`);

    noble.once(k.OBCINobleEmitterScanStop, () => {
      this._scanning = false;
      this.emit(k.OBCINobleEmitterScanStop);
      if (this.options.verbose) console.log('Scan stopped');
      resolve();
    });
    // Stop noble from scanning
    noble.stopScanning();
  });
};

/**
 * Route incoming data to proper functions
 * @param data {Buffer} - Data buffer from noble CytonBLE.
 * @private
 */
CytonBLE.prototype._processBytes = function (data) {
  if (this.options.debug) obciDebug.debugBytes('<<', data);
  this.lastPacket = data;
  this._packetCounter++;
  const rawDataPackets = obciUtils.extractRawBLEDataPackets(data);

  _.forEach(rawDataPackets, (rawDataPacket) => {
    // Emit that buffer
    this.emit(k.OBCIEmitterRawDataPacket, rawDataPacket);
    // Submit the packet for processing
    let missedPacketArray = [];
    const curSampleNumber = rawDataPacket[k.OBCIPacketPositionSampleNumber];

    const sampleDiff = curSampleNumber - this.previousSampleNumber;
    let numMissed = 0;

    if (this.previousSampleNumber === -1) {
      numMissed = 0;
    } else if (sampleDiff > 1) {
      numMissed = sampleDiff - 1;
    } else if (sampleDiff < 0) {
      numMissed = 130 + sampleDiff;
      if (numMissed === 3) {
        numMissed = 0;
      }
    }
    for (let i = 0; i < numMissed; i++) {
      let missedSampleNumber = this.previousSampleNumber + i + 1;
      if (missedSampleNumber > 130) {
        missedSampleNumber -= 131;
      }
      missedPacketArray.push(missedSampleNumber);
    }

    if (missedPacketArray.length > 0) {
      this.emit(k.OBCIEmitterDroppedPacket, missedPacketArray);
    }
    this.previousSampleNumber = rawDataPacket[k.OBCIPacketPositionSampleNumber];
    this._rawDataPacketToSample.rawDataPacket = rawDataPacket;
    const sample = obciUtils.transformRawDataPacketToSample(this._rawDataPacketToSample);
    sample._count = this.sampleCount++;
    if (this.impedanceTest.active) {
      this._processImpedanceTest(sample);
    } else {
      this.emit(k.OBCIEmitterSample, sample);
    }
  });
};

/**
 * @description A method used to compute impedances.
 * @param sampleObject - A sample object that follows the normal standards.
 * @private
 * @author AJ Keller (@pushtheworldllc)
 */
CytonBLE.prototype._processImpedanceTest = function (sampleObject) {
  let impedanceArray;
  if (this.impedanceTest.continuousMode) {
    // console.log('running in continuous mode...')
    // obciUtils.debugPrettyPrint(sampleObject)
    impedanceArray = obciUtils.impedanceCalculateArray(sampleObject, this.impedanceTest);
    if (impedanceArray) {
      this.emit('impedanceArray', impedanceArray);
    }
  } else if (this.impedanceTest.onChannel !== 0) {
    // Only calculate impedance for one channel
    impedanceArray = obciUtils.impedanceCalculateArray(sampleObject, this.impedanceTest);
    if (impedanceArray) {
      this.impedanceTest.impedanceForChannel = impedanceArray[this.impedanceTest.onChannel - 1];
    }
  }
};

module.exports = CytonBLE;
