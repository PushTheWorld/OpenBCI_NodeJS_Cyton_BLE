const CytonBLE = require('../../index').CytonBLE;
const k = require('openbci-utilities').Constants;
const verbose = true;
let cytonBLE = new CytonBLE({
  debug: false,
  sendCounts: false,
  verbose: verbose
}, (error) => {
  if (error) {
    console.log(error);
  } else {
    if (verbose) {
      console.log('CytonBLE initialize completed');
    }
  }
});

function errorFunc (err) {
  throw err;
}

const impedance = false;
const accel = false;

cytonBLE.once(k.OBCIEmitterRFduino, (peripheral) => {
  cytonBLE.searchStop().catch(errorFunc);

  let droppedPacketCounter = 0;
  let secondCounter = 0;
  let buf = [];
  let sizeOfBuf = 0;
  cytonBLE.on('sample', (sample) => {
    /** Work with sample */
    console.log(sample.sampleNumber);

    // UNCOMMENT BELOW FOR DROPPED PACKET CALCULATIONS...
    // if (sample.sampleNumber === 0) {
    //   buf.push(droppedPacketCounter);
    //   sizeOfBuf++;
    //   droppedPacketCounter = 0;
    //   if (sizeOfBuf >= 60) {
    //     var sum = 0;
    //     for (let i = 0; i < buf.length; i++) {
    //       sum += parseInt(buf[i], 10);
    //     }
    //     const percentDropped = sum / 6000 * 100;
    //     console.log(`dropped packet rate: ${sum} - percent dropped: %${percentDropped.toFixed(2)}`);
    //     buf.shift();
    //   } else {
    //     console.log(`time till average rate starts ${60 - sizeOfBuf}`);
    //   }
    // }
  });

  cytonBLE.on('close', () => {
    console.log('close event');
  });

  cytonBLE.on('droppedPacket', (data) => {
    console.log('droppedPacket:', data);
    droppedPacketCounter++;
  });

  cytonBLE.on('message', (message) => {
    console.log('message: ', message.toString());
  });


  cytonBLE.on('impedanceArray', (impedanceArray) => {
    console.log(`impedanceArray ${JSON.stringify(impedanceArray)}`);
  });

  cytonBLE.once('ready', () => {
    cytonBLE.streamStart().catch(errorFunc);
      console.log('ready');

  });

  cytonBLE.connect(peripheral).catch(errorFunc);
});

function exitHandler (options, err) {
  if (options.cleanup) {
    if (verbose) console.log('clean');
    // console.log(connectedPeripheral)
    cytonBLE.manualDisconnect = true;
    cytonBLE.disconnect();
    cytonBLE.removeAllListeners('droppedPacket');
    cytonBLE.removeAllListeners('accelerometer');
    cytonBLE.removeAllListeners('sample');
    cytonBLE.removeAllListeners('message');
    cytonBLE.removeAllListeners('impedance');
    cytonBLE.removeAllListeners('close');
    cytonBLE.removeAllListeners('error');
    cytonBLE.removeAllListeners(k.OBCIEmitterRFduino);
    cytonBLE.removeAllListeners('ready');
    cytonBLE.destroyNoble();

  }
  if (err) console.log(err.stack);
  if (options.exit) {
    if (verbose) console.log('exit');

    cytonBLE.manualDisconnect = true;
    cytonBLE.disconnect(true).catch(console.log);
    process.exit(0);
  }
}

if (process.platform === "win32") {
  const rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on("SIGINT", function () {
    process.emit("SIGINT");
  });
}

// do something when app is closing
process.on('exit', exitHandler.bind(null, {
  cleanup: true
}));

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {
  exit: true
}));

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {
  exit: true
}));
