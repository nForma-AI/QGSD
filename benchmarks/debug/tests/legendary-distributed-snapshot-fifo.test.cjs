'use strict';
const { processMessage } = require('../../../bin/bench-buggy-legendary-distributed-snapshot-fifo.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

var state = {recording: true, markerReceived: {ch1: false}, inTransit: []};

// Messages arriving before marker on ch1 must be captured as in-transit
processMessage(state, 'ch1', {value: 42});
processMessage(state, 'ch1', {value: 17});
assert('in-transit messages recorded', state.inTransit.length, 2);
assert('first message captured', state.inTransit[0] && state.inTransit[0].value, 42);
assert('second message captured', state.inTransit[1] && state.inTransit[1].value, 17);

// After marker received on ch1, stop recording
var beforeMarkerLength = state.inTransit.length;
state.markerReceived.ch1 = true;
processMessage(state, 'ch1', {value: 99});
assert('post-marker message not recorded', state.inTransit.length, beforeMarkerLength);

// Not recording → messages ignored
var state2 = {recording: false, markerReceived: {ch2: false}, inTransit: []};
processMessage(state2, 'ch2', {value: 55});
assert('not recording: message ignored', state2.inTransit.length, 0);

process.exit(failed > 0 ? 1 : 0);
