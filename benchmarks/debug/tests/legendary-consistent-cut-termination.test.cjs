'use strict';
const { isSnapshotComplete } = require('../../../bin/bench-buggy-legendary-consistent-cut-termination.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

var process1 = {
  incomingChannels: ['ch1', 'ch2', 'ch3'],
  markersReceived: {ch1: true, ch2: false, ch3: false}
};
assert('not complete when only one channel done', isSnapshotComplete(process1), false);

var process2 = {
  incomingChannels: ['ch1', 'ch2'],
  markersReceived: {ch1: true, ch2: true}
};
assert('complete when all channels done', isSnapshotComplete(process2), true);

var process3 = {
  incomingChannels: ['ch1'],
  markersReceived: {ch1: false}
};
assert('not complete when no channels done', isSnapshotComplete(process3), false);

var process4 = {
  incomingChannels: ['ch1', 'ch2', 'ch3'],
  markersReceived: {ch1: false, ch2: true, ch3: false}
};
assert('not complete when middle channel done but not others', isSnapshotComplete(process4), false);

process.exit(failed > 0 ? 1 : 0);
