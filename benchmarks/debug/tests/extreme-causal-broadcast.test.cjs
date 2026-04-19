'use strict';
var { canDeliver } = require('../../../bin/bench-buggy-extreme-causal-broadcast.cjs');
var failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// delivered[p1]=2 means messages 1 and 2 from p1 have been delivered.
var delivered = {p1: 2};

// Can deliver seq=3 (exactly next)
assert('delivers next in sequence (seq=3)', canDeliver(delivered, {sender: 'p1', seqNum: 3}) === true,
  'got false');

// Must NOT deliver seq=4 (gap: seq=3 not yet delivered)
assert('rejects gap seq=4', canDeliver(delivered, {sender: 'p1', seqNum: 4}) === false,
  'canDeliver returned true for seqNum=4 with only 2 delivered — causal gap');

// Must NOT re-deliver seq=2 (already seen)
assert('rejects duplicate seq=2', canDeliver(delivered, {sender: 'p1', seqNum: 2}) === false,
  'canDeliver returned true for seqNum=2 (already delivered) — duplicate delivery');

// Must NOT re-deliver seq=1 (already seen)
assert('rejects older msg seq=1', canDeliver(delivered, {sender: 'p1', seqNum: 1}) === false,
  'canDeliver returned true for seqNum=1 (already delivered)');

// New sender: can only deliver seq=1 first
var fresh = {};
assert('new sender: delivers seq=1', canDeliver(fresh, {sender: 'p2', seqNum: 1}) === true,
  'got false');
assert('new sender: rejects seq=2 (gap)', canDeliver(fresh, {sender: 'p2', seqNum: 2}) === false,
  'canDeliver returned true for seq=2 on new sender — gap allowed');

// Enumerate: delivered[sender]=N, check all seqNums
for (var deliveredN = 0; deliveredN <= 4; deliveredN++) {
  var state = {p: deliveredN};
  for (var seq = 0; seq <= 6; seq++) {
    var expected = seq === deliveredN + 1;
    var got = canDeliver(state, {sender: 'p', seqNum: seq});
    assert(
      'canDeliver(delivered=' + deliveredN + ',seq=' + seq + ')',
      got === expected,
      'expected ' + expected + ' got ' + got
    );
  }
}

process.exit(failed > 0 ? 1 : 0);
