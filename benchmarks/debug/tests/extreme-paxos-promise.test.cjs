'use strict';
var { f } = require('../../../bin/bench-buggy-extreme-paxos-promise.cjs');
var failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Formal invariant: f(a, promised) iff a > promised (strictly greater).
// Enumeration over all (a, promised) pairs in [0..5]:
for (var promised = 0; promised <= 5; promised++) {
  for (var a = 0; a <= 5; a++) {
    var expected = a > promised;
    var got = f(a, promised);
    assert(
      'f(' + a + ',' + promised + ')',
      got === expected,
      'expected ' + expected + ' got ' + got
    );
  }
}

// Specific dual-promise scenario:
// Acceptor has promised a 3 (b = 3).
// Proposer A arrives with a 3 — must be rejected (already promised 3, new must be > 3).
// Proposer B also arrives with a 3 — must also be rejected.
// With bug: 3 >= 3 = true → BOTH get a promise → dual promise violation.
var promisedAfterFirst = 3;
var canSecondProposerPromise = f(3, promisedAfterFirst);
assert(
  'no dual promise: second proposer with same a rejected',
  canSecondProposerPromise === false,
  'f(3,3) returned true — two proposers with a 3 both got promises'
);

// Edge: a 0 with b 0 must NOT promise (0 is not > 0)
assert('a=0 promised=0 no promise', f(0, 0) === false,
  'got ' + f(0, 0));

// Higher a always promises when above current
assert('a=4 promised=3 does promise', f(4, 3) === true,
  'got ' + f(4, 3));

// Strictly less: never promises
assert('a=2 promised=3 no promise', f(2, 3) === false,
  'got ' + f(2, 3));

process.exit(failed > 0 ? 1 : 0);
