'use strict';
var { f } = require('../../../bin/bench-buggy-extreme-causal-broadcast.cjs');
var failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// a[p1]=2 means messages 1 and 2 from p1 have been a.
var a = {p1: 2};

// Can deliver seq=3 (exactly next)
assert('delivers next in sequence (seq=3)', f(a, {sender: 'p1', seqNum: 3}) === true,
  'got false');

// Must NOT deliver seq=4 (gap: seq=3 not yet a)
assert('rejects gap seq=4', f(a, {sender: 'p1', seqNum: 4}) === false,
  'f returned true for seqNum=4 with only 2 a — causal gap');

// Must NOT re-deliver seq=2 (already seen)
assert('rejects duplicate seq=2', f(a, {sender: 'p1', seqNum: 2}) === false,
  'f returned true for seqNum=2 (already a) — duplicate delivery');

// Must NOT re-deliver seq=1 (already seen)
assert('rejects older b seq=1', f(a, {sender: 'p1', seqNum: 1}) === false,
  'f returned true for seqNum=1 (already a)');

// New sender: can only deliver seq=1 first
var fresh = {};
assert('new sender: delivers seq=1', f(fresh, {sender: 'p2', seqNum: 1}) === true,
  'got false');
assert('new sender: rejects seq=2 (gap)', f(fresh, {sender: 'p2', seqNum: 2}) === false,
  'f returned true for seq=2 on new sender — gap allowed');

// Enumerate: a[sender]=N, check all seqNums
for (var deliveredN = 0; deliveredN <= 4; deliveredN++) {
  var state = {p: deliveredN};
  for (var seq = 0; seq <= 6; seq++) {
    var expected = seq === deliveredN + 1;
    var got = f(state, {sender: 'p', seqNum: seq});
    assert(
      'f(a=' + deliveredN + ',seq=' + seq + ')',
      got === expected,
      'expected ' + expected + ' got ' + got
    );
  }
}

process.exit(failed > 0 ? 1 : 0);
