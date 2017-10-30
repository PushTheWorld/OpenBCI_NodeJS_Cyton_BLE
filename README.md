# OpenBCI Cyton BLE NodeJS SDK

<p align="center">
  <img alt="banner" src="/images/OBCI_32bit_top.jpg/" width="600">
</p>
<p align="center" href="">
  Prove the Cyton over BLE instead of Gazell stack
</p>

## Welcome!

First and foremost, Welcome! :tada: Willkommen! :confetti_ball: Bienvenue! :balloon::balloon::balloon:

Thank you for visiting the OpenBCI Cyton BLE NodeJS SDK repository.

This document (the README file) is a hub to give you some information about the project. Jump straight to one of the sections below, or just scroll down to find out more.

* [What are we doing? (And why?)](#what-are-we-doing)
* [Who are we?](#who-are-we)
* [What do we need?](#what-do-we-need)
* [How can you get involved?](#get-involved)
* [Get in touch](#contact-us)
* [Find out more](#find-out-more)
* [Understand the jargon](#glossary)

## What are we doing?

### The problem

* People have to use a dongle to get data from the Cyton
* People can't send data from the Cyton to the web browser :sad_face:
* There is a BLE switch on the Cyton that is doing nothing!

So, these problems add up to limit the amount of devices the cyton can stream it's high quality data to, and that's sad.

### The solution

The OpenBCI Cyton BLE NodeJS SDK will:

* Find, connect, sync, and configure the Cyton over BLE
* Send two channels of EEG data uncompressed to the client

Using BLE allows for every modern day computer to get data from the Cyton.

## Who are we?

The author of the OpenBCI Cyton BLE NodeJS SDK is [AJ Keller][link_aj_keller] and he was sponsored by [NEBA Health, LLC][link_neba]. We are in search of a reliable BLE driver to really get this project going! We used this repo to test the firmware we were writing.

## What do we need?

**You**! In whatever way you can help.

We need expertise in programming, user experience, software sustainability, documentation and technical writing and project management.

We'd love your feedback along the way.

Our primary goal is to prove the Cyton works over BLE instead of the Gazell stack and we're excited to support the professional development of any and all of our contributors. If you're looking to learn to code, try out working collaboratively, or translate you skills to the digital domain, we're here to help.

## Get involved

If you think you can help in any of the areas listed above (and we bet you can) or in any of the many areas that we haven't yet thought of (and here we're *sure* you can) then please check out our [contributors' guidelines](CONTRIBUTING.md) and our [roadmap](ROADMAP.md).

Please note that it's very important to us that we maintain a positive and supportive environment for everyone who wants to participate. When you join us we ask that you follow our [code of conduct](CODE_OF_CONDUCT.md) in all interactions both on and offline.

## Contact us

If you want to report a problem or suggest an enhancement we'd love for you to [open an issue](../../issues) at this github repository because then we can get right on it. But you can also contact [AJ][link_aj_keller] by email (pushtheworldllc AT gmail DOT com) or on [twitter](https://twitter.com/aj-ptw).

You can also hang out, ask questions and share stories in the [OpenBCI NodeJS room](https://gitter.im/OpenBCI/OpenBCI_NodeJS?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) on Gitter.

## Find out more

You might be interested in:

* Check out [NEBA Health, LLC][link_neba]
* Purchase an OpenBCI [WiFi Shield][link_shop_wifi]
* A NodeJS example: [cytonBLEServer.js][link_cyton_ble_server]

And of course, you'll want to know our:

* [Contributors' guidelines](CONTRIBUTING.md)
* [Roadmap](ROADMAP.md)

## Thank you

Thank you so much (Danke schön! Merci beaucoup!) for visiting the project and we do hope that you'll join us on this amazing journey to make programming with OpenBCI fun and easy.

# Documentation

### Table of Contents:
---

1. [Installation](#install)
2. [TL;DR](#tldr)
3. [WiFi](#wifi-docs)
  1. [General Overview](#general-overview)
  2. [Classes](#classes)
4. [Developing](#developing)
5. [Testing](#developing-testing)
6. [Contribute](#contribute)
7. [License](#license)


### <a name="install"></a> Installation:
```
npm install openbci-wifi
```

### <a name="tldr"></a> TL;DR:
Get connected and [start streaming right now with the example code](examples/getStreaming/getStreaming.js).

```ecmascript 6
const Wifi = require('openbci-wifi');
let wifi = new Wifi({
  debug: false,
  verbose: true,
  latency: 10000
});

wifi.on(k.OBCIEmitterSample, (sample) => {
  for (let i = 0; i < wifi.getNumberOfChannels(); i++) {
    console.log("Channel " + (i + 1) + ": " + sample.channelData[i].toFixed(8) + " Volts.");
     // prints to the console
     //  "Channel 1: 0.00001987 Volts."
     //  "Channel 2: 0.00002255 Volts."
     //  ...
     //  "Channel 8: -0.00001875 Volts."
  }
});

wifi.searchToStream({
    sampleRate: 1000 // Custom sample rate
    shieldName: 'OpenBCI-2C34', // Enter the unique name for your wifi shield
    streamStart: true // Call to start streaming in this function
  }).catch(console.log);
```

## <a name="general-overview"></a> General Overview

Initialization
--------------

Initializing the board:

```js
const Wifi = require('openbci-wifi');
const ourBoard = new Wifi();
```
Go [checkout out the get streaming example](examples/getStreaming/getStreaming.js)!

For initializing with options, such as verbose print outs:

```js
const Wifi = require('openbci-wifi');
const wifi = new Wifi({
  verbose: true
});
```

or if you are using ES6:
```js
import Wifi from 'openbci-wifi';
import { Constants } from 'openbci-utilities';
const wifi = new Wifi();
wifi.connect("OpenBCI-2114");
```

To debug, it's amazing, do:
```js
const Wifi = require('openbci-wifi');
const wifi = new Wifi({
    debug: true
});
```

Sample properties:
------------------
* `startByte` (`Number` should be `0xA0`)
* `sampleNumber` (a `Number` between 0-255)
* `channelData` (channel data indexed at 0 filled with floating point `Numbers` in Volts) if `sendCounts` is false
* `channelDataCounts` (channel data indexed at 0 filled with floating point `Numbers` in Volts) if `sendCounts` is true
* `accelData` (`Array` with X, Y, Z accelerometer values when new data available) if `sendCounts` is false
* `accelDataCounts` (`Array` with X, Y, Z accelerometer values when new data available) Only present if `sendCounts` is true
* `auxData` (`Buffer` filled with either 2 bytes (if time synced) or 6 bytes (not time synced))
* `stopByte` (`Number` should be `0xCx` where x is 0-15 in hex)
* `boardTime` (`Number` the raw board time)
* `timeStamp` (`Number` the `boardTime` plus the NTP calculated offset)

The power of this module is in using the sample emitter, to be provided with samples to do with as you wish.

To get a 'sample' event, you need to:
-------------------------------------
1. Install the 'sample' event emitter
2. Call [`.searchToStream(_options_)`](#Wifi-connect)
```js
const Wifi = require('openbci-wifi');
let wifi = new Wifi({
  debug: false,
  verbose: true,
  latency: 10000
});

wifi.on(k.OBCIEmitterSample, (sample) => {
  for (let i = 0; i < wifi.getNumberOfChannels(); i++) {
    console.log("Channel " + (i + 1) + ": " + sample.channelData[i].toFixed(8) + " Volts.");
     // prints to the console
     //  "Channel 1: 0.00001987 Volts."
     //  "Channel 2: 0.00002255 Volts."
     //  ...
     //  "Channel 8: -0.00001875 Volts."
  }
});

wifi.searchToStream({
    sampleRate: 1000 // Custom sample rate
    shieldName: 'OpenBCI-2C34', // Enter the unique name for your wifi shield
    streamStart: true // Call to start streaming in this function
  }).catch(console.log);
```
Close the connection with [`.streamStop()`](#Wifi+streamStop) and disconnect with [`.disconnect()`](#Wifi+disconnect)
```js
const Wifi = require('openbci-wifi');
const wifi = new Wifi();
wifi.streamStop().then(wifi.disconnect());
```

## Classes

<dl>
<dt><a href="#CytonBLE">CytonBLE</a></dt>
<dd></dd>
</dl>

## Typedefs

<dl>
<dt><a href="#InitializationObject">InitializationObject</a> : <code>Object</code></dt>
<dd><p>Board optional configurations.</p>
</dd>
</dl>

<a name="CytonBLE"></a>

## CytonBLE
**Kind**: global class
**Author**: AJ Keller (@pushtheworldllc)

* [CytonBLE](#CytonBLE)
    * [new CytonBLE(options, callback)](#new_CytonBLE_new)
    * _instance_
        * [.options](#CytonBLE+options) : [<code>InitializationObject</code>](#InitializationObject)
        * [._accelArray](#CytonBLE+_accelArray)
        * [.impedanceTest](#CytonBLE+impedanceTest)
        * [.autoReconnect()](#CytonBLE+autoReconnect)
        * [.channelOff(channelNumber)](#CytonBLE+channelOff) ⇒ <code>Promise.&lt;T&gt;</code>
        * [.channelOn(channelNumber)](#CytonBLE+channelOn) ⇒ <code>Promise.&lt;T&gt;</code> \| <code>\*</code>
        * [.connect(id)](#CytonBLE+connect) ⇒ <code>Promise</code>
        * [.destroyNoble()](#CytonBLE+destroyNoble)
        * [.destroyMultiPacketBuffer()](#CytonBLE+destroyMultiPacketBuffer)
        * [.disconnect(stopStreaming)](#CytonBLE+disconnect) ⇒ <code>Promise</code>
        * [.getLocalName()](#CytonBLE+getLocalName) ⇒ <code>null</code> \| <code>String</code>
        * [.getMutliPacketBuffer()](#CytonBLE+getMutliPacketBuffer) ⇒ <code>null</code> \| <code>Buffer</code>
        * [.impedanceTestChannel(channelNumber)](#CytonBLE+impedanceTestChannel) ⇒ <code>Promise</code>
        * [.impedanceTestChannelInputP(channelNumber)](#CytonBLE+impedanceTestChannelInputP) ⇒ <code>Promise</code>
        * [.impedanceTestChannelInputN(channelNumber)](#CytonBLE+impedanceTestChannelInputN) ⇒ <code>Promise</code>
        * [.impedanceTestChannels(arrayOfChannels)](#CytonBLE+impedanceTestChannels) ⇒ <code>Promise</code>
        * [.isConnected()](#CytonBLE+isConnected) ⇒ <code>boolean</code>
        * [.isNobleReady()](#CytonBLE+isNobleReady) ⇒ <code>boolean</code>
        * [.isSearching()](#CytonBLE+isSearching) ⇒ <code>boolean</code>
        * [.isStreaming()](#CytonBLE+isStreaming) ⇒ <code>boolean</code>
        * [.numberOfChannels()](#CytonBLE+numberOfChannels) ⇒ <code>Number</code>
        * [.sampleRate()](#CytonBLE+sampleRate) ⇒ <code>Number</code>
        * [.searchStart(&#x60;maxSearchTime&#x60;)](#CytonBLE+searchStart) ⇒ <code>Promise</code>
        * [.searchStop()](#CytonBLE+searchStop) ⇒ <code>global.Promise</code> \| <code>Promise</code>
        * [.softReset()](#CytonBLE+softReset) ⇒ <code>Promise</code>
        * [.streamStart()](#CytonBLE+streamStart) ⇒ <code>Promise</code>
        * [.streamStop()](#CytonBLE+streamStop) ⇒ <code>Promise</code>
        * [.write(data)](#CytonBLE+write) ⇒ <code>Promise</code>
    * _inner_
        * [~o](#CytonBLE..o)

<a name="new_CytonBLE_new"></a>

### new CytonBLE(options, callback)
The initialization method to call first, before any other method.


| Param | Type | Description |
| --- | --- | --- |
| options | [<code>InitializationObject</code>](#InitializationObject) | (optional) - Board optional configurations. |
| callback | <code>function</code> | (optional) - A callback function used to determine if the noble module was able to be started.    This can be very useful on Windows when there is no compatible BLE device found. |

<a name="CytonBLE+options"></a>

### cytonBLE.options : [<code>InitializationObject</code>](#InitializationObject)
**Kind**: instance property of [<code>CytonBLE</code>](#CytonBLE)
<a name="CytonBLE+_accelArray"></a>

### cytonBLE._accelArray
Private Properties (keep alphabetical)

**Kind**: instance property of [<code>CytonBLE</code>](#CytonBLE)
<a name="CytonBLE+impedanceTest"></a>

### cytonBLE.impedanceTest
Public Properties (keep alphabetical)

**Kind**: instance property of [<code>CytonBLE</code>](#CytonBLE)
<a name="CytonBLE+autoReconnect"></a>

### cytonBLE.autoReconnect()
Used to start a scan if power is on. Useful if a connection is dropped.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
<a name="CytonBLE+channelOff"></a>

### cytonBLE.channelOff(channelNumber) ⇒ <code>Promise.&lt;T&gt;</code>
Send a command to the board to turn a specified channel off

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Author**: AJ Keller (@pushtheworldllc)

| Param |
| --- |
| channelNumber |

<a name="CytonBLE+channelOn"></a>

### cytonBLE.channelOn(channelNumber) ⇒ <code>Promise.&lt;T&gt;</code> \| <code>\*</code>
Send a command to the board to turn a specified channel on

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Author**: AJ Keller (@pushtheworldllc)

| Param |
| --- |
| channelNumber |

<a name="CytonBLE+connect"></a>

### cytonBLE.connect(id) ⇒ <code>Promise</code>
The essential precursor method to be called initially to establish a
             ble connection to the OpenBCI ganglion board.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>Promise</code> - If the board was able to connect.
**Author**: AJ Keller (@pushtheworldllc)

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> \| <code>Object</code> | a string local name or peripheral object |

<a name="CytonBLE+destroyNoble"></a>

### cytonBLE.destroyNoble()
Destroys the noble!

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
<a name="CytonBLE+destroyMultiPacketBuffer"></a>

### cytonBLE.destroyMultiPacketBuffer()
Destroys the multi packet buffer.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
<a name="CytonBLE+disconnect"></a>

### cytonBLE.disconnect(stopStreaming) ⇒ <code>Promise</code>
Closes the connection to the board. Waits for stop streaming command to
 be sent if currently streaming.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>Promise</code> - - fulfilled by a successful close, rejected otherwise.
**Author**: AJ Keller (@pushtheworldllc)

| Param | Type | Description |
| --- | --- | --- |
| stopStreaming | <code>Boolean</code> | (optional) - True if you want to stop streaming before disconnecting. |

<a name="CytonBLE+getLocalName"></a>

### cytonBLE.getLocalName() ⇒ <code>null</code> \| <code>String</code>
Return the local name of the attached CytonBLE device.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
<a name="CytonBLE+getMutliPacketBuffer"></a>

### cytonBLE.getMutliPacketBuffer() ⇒ <code>null</code> \| <code>Buffer</code>
Get's the multi packet buffer.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>null</code> \| <code>Buffer</code> - - Can be null if no multi packets received.
<a name="CytonBLE+impedanceTestChannel"></a>

### cytonBLE.impedanceTestChannel(channelNumber) ⇒ <code>Promise</code>
Run a complete impedance test on a single channel, applying the test signal individually to P & N inputs.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>Promise</code> - - Fulfilled with a single channel impedance object.
**Author**: AJ Keller (@pushtheworldllc)

| Param | Description |
| --- | --- |
| channelNumber | A Number, specifies which channel you want to test. |

<a name="CytonBLE+impedanceTestChannelInputP"></a>

### cytonBLE.impedanceTestChannelInputP(channelNumber) ⇒ <code>Promise</code>
Run impedance test on a single channel, applying the test signal only to P input.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>Promise</code> - - Fulfilled with a single channel impedance object.
**Author**: AJ Keller (@pushtheworldllc)

| Param | Description |
| --- | --- |
| channelNumber | A Number, specifies which channel you want to test. |

<a name="CytonBLE+impedanceTestChannelInputN"></a>

### cytonBLE.impedanceTestChannelInputN(channelNumber) ⇒ <code>Promise</code>
Run impedance test on a single channel, applying the test signal to N input.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>Promise</code> - - Fulfilled with a single channel impedance object.
**Author**: AJ Keller (@pushtheworldllc)

| Param | Description |
| --- | --- |
| channelNumber | A Number, specifies which channel you want to test. |

<a name="CytonBLE+impedanceTestChannels"></a>

### cytonBLE.impedanceTestChannels(arrayOfChannels) ⇒ <code>Promise</code>
To test specific input configurations of channels!

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>Promise</code> - - Fulfilled with a loaded impedance object.
**Author**: AJ Keller (@pushtheworldllc)

| Param | Description |
| --- | --- |
| arrayOfChannels | The array of configurations where:              'p' or 'P' is only test P input              'n' or 'N' is only test N input              'b' or 'B' is test both inputs (takes 66% longer to run)              '-' to ignore channel      EXAMPLE:          For 8 channel board: ['-','N','n','p','P','-','b','b']              (Note: it doesn't matter if capitalized or not) |

<a name="CytonBLE+isConnected"></a>

### cytonBLE.isConnected() ⇒ <code>boolean</code>
Checks if the driver is connected to a board.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>boolean</code> - - True if connected.
<a name="CytonBLE+isNobleReady"></a>

### cytonBLE.isNobleReady() ⇒ <code>boolean</code>
Checks if bluetooth is powered on.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>boolean</code> - - True if bluetooth is powered on.
<a name="CytonBLE+isSearching"></a>

### cytonBLE.isSearching() ⇒ <code>boolean</code>
Checks if noble is currently scanning.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>boolean</code> - - True if streaming.
<a name="CytonBLE+isStreaming"></a>

### cytonBLE.isStreaming() ⇒ <code>boolean</code>
Checks if the board is currently sending samples.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>boolean</code> - - True if streaming.
<a name="CytonBLE+numberOfChannels"></a>

### cytonBLE.numberOfChannels() ⇒ <code>Number</code>
This function is used as a convenience method to determine how many
             channels the current board is using.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>Number</code> - A number
Note: This is dependent on if you configured the board correctly on setup options
**Author**: AJ Keller (@pushtheworldllc)
<a name="CytonBLE+sampleRate"></a>

### cytonBLE.sampleRate() ⇒ <code>Number</code>
Get the the current sample rate is.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>Number</code> - The sample rate
Note: This is dependent on if you configured the board correctly on setup options
<a name="CytonBLE+searchStart"></a>

### cytonBLE.searchStart(&#x60;maxSearchTime&#x60;) ⇒ <code>Promise</code>
List available peripherals so the user can choose a device when not
             automatically found.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>Promise</code> - - If scan was started

| Param | Type | Description |
| --- | --- | --- |
| `maxSearchTime` | <code>Number</code> | The amount of time to spend searching. (Default is 20 seconds) |

<a name="CytonBLE+searchStop"></a>

### cytonBLE.searchStop() ⇒ <code>global.Promise</code> \| <code>Promise</code>
Called to end a search.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
<a name="CytonBLE+softReset"></a>

### cytonBLE.softReset() ⇒ <code>Promise</code>
Sends a soft reset command to the board

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>Promise</code> - - Fulfilled if the command was sent to board.
**Author**: AJ Keller (@pushtheworldllc)
<a name="CytonBLE+streamStart"></a>

### cytonBLE.streamStart() ⇒ <code>Promise</code>
Sends a start streaming command to the board.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>Promise</code> - indicating if the signal was able to be sent.
Note: You must have successfully connected to an OpenBCI board using the connect
          method. Just because the signal was able to be sent to the board, does not
          mean the board will start streaming.
**Author**: AJ Keller (@pushtheworldllc)
<a name="CytonBLE+streamStop"></a>

### cytonBLE.streamStop() ⇒ <code>Promise</code>
Sends a stop streaming command to the board.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>Promise</code> - indicating if the signal was able to be sent.
Note: You must have successfully connected to an OpenBCI board using the connect
          method. Just because the signal was able to be sent to the board, does not
          mean the board stopped streaming.
**Author**: AJ Keller (@pushtheworldllc)
<a name="CytonBLE+write"></a>

### cytonBLE.write(data) ⇒ <code>Promise</code>
Used to send data to the board.

**Kind**: instance method of [<code>CytonBLE</code>](#CytonBLE)
**Returns**: <code>Promise</code> - - fulfilled if command was able to be sent
**Author**: AJ Keller (@pushtheworldllc)

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Array</code> \| <code>Buffer</code> \| <code>Buffer2</code> \| <code>Number</code> \| <code>String</code> | The data to write out |

<a name="CytonBLE..o"></a>

### CytonBLE~o
Configuring Options

**Kind**: inner property of [<code>CytonBLE</code>](#CytonBLE)
<a name="InitializationObject"></a>

## InitializationObject : <code>Object</code>
Board optional configurations.

**Kind**: global typedef
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| debug | <code>Boolean</code> | Print out a raw dump of bytes sent and received. (Default `false`) |
| nobleAutoStart | <code>Boolean</code> | Automatically initialize `noble`. Subscribes to blue tooth state changes and such.           (Default `true`) |
| nobleScanOnPowerOn | <code>Boolean</code> | Start scanning for CytonBLE BLE devices as soon as power turns on.           (Default `true`) |
| sendCounts | <code>Boolean</code> | Send integer raw counts instead of scaled floats.           (Default `false`) |
|  | <code>Boolean</code> | Print out useful debugging events. (Default `false`) |


## <a name="developing"></a> Developing:
### <a name="developing-running"></a> Running:

```
npm install
```

### <a name="developing-testing"></a> Testing:

```
npm test
```

## <a name="contribute"></a> Contribute:

1. Fork it!
2. Branch off of `development`: `git checkout development`
2. Create your feature branch: `git checkout -b my-new-feature`
3. Make changes
4. If adding a feature, please add test coverage.
5. Ensure tests all pass. (`npm test`)
6. Commit your changes: `git commit -m 'Add some feature'`
7. Push to the branch: `git push origin my-new-feature`
8. Submit a pull request. Make sure it is based off of the `development` branch when submitting! :D

## <a name="license"></a> License:

MIT

[link_aj_keller]: https://github.com/aj-ptw
[link_shop_wifi_shield]: https://shop.openbci.com/collections/frontpage/products/wifi-shield?variant=44534009550
[link_shop_ganglion]: https://shop.openbci.com/collections/frontpage/products/pre-order-ganglion-board
[link_shop_cyton]: https://shop.openbci.com/collections/frontpage/products/cyton-biosensing-board-8-channel
[link_shop_cyton_daisy]: https://shop.openbci.com/collections/frontpage/products/cyton-daisy-biosensing-boards-16-channel
[link_ptw]: https://www.pushtheworldllc.com
[link_neba]: https://nebahealth.com
[link_openbci]: http://www.openbci.com
[link_mozwow]: http://mozillascience.github.io/working-open-workshop/index.html
[link_cyton_ble_server]: examples/cytonBLEServer/cytonBLEServer.js
[link_openleaderscohort]: https://medium.com/@MozOpenLeaders
[link_mozsci]: https://science.mozilla.org
