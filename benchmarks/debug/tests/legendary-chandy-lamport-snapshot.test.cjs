'use strict';
const { takeSnapshot } = require('../../../bin/bench-buggy-legendary-chandy-lamport-snapshot.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var stateValue = 10;
var proc = {
  localState: null,
  sendMarker: function() {
    // Simulates: after sending marker, an incoming message arrives and updates state
    stateValue += 5;  // state changes after marker sent
  },
  recordState: function() {
    this.localState = stateValue;  // records current value of stateValue
  }
};
var snapshot = takeSnapshot(proc);
// Correct: recordState() should run BEFORE sendMarker() so snapshot=10 (pre-marker value)
// Buggy: sendMarker runs first, stateValue becomes 15, then recordState records 15
assert('snapshot captures pre-marker state', snapshot, 10);

process.exit(failed > 0 ? 1 : 0);
