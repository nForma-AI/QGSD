'use strict';
var { shouldPromise } = require('../../../bin/bench-buggy-extreme-paxos-promise.cjs');
var failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}

// Formal invariant: shouldPromise(ballot, promised) iff ballot > promised (strictly greater).
// Enumeration over all (ballot, promised) pairs in [0..5]:
for (var promised = 0; promised <= 5; promised++) {
  for (var ballot = 0; ballot <= 5; ballot++) {
    var expected = ballot > promised;
    var got = shouldPromise(ballot, promised);
    assert(
      'shouldPromise(' + ballot + ',' + promised + ')',
      got === expected,
      'expected ' + expected + ' got ' + got
    );
  }
}

// Specific dual-promise scenario:
// Acceptor has promised ballot 3 (promisedBallot = 3).
// Proposer A arrives with ballot 3 — must be rejected (already promised 3, new must be > 3).
// Proposer B also arrives with ballot 3 — must also be rejected.
// With bug: 3 >= 3 = true → BOTH get a promise → dual promise violation.
var promisedAfterFirst = 3;
var canSecondProposerPromise = shouldPromise(3, promisedAfterFirst);
assert(
  'no dual promise: second proposer with same ballot rejected',
  canSecondProposerPromise === false,
  'shouldPromise(3,3) returned true — two proposers with ballot 3 both got promises'
);

// Edge: ballot 0 with promisedBallot 0 must NOT promise (0 is not > 0)
assert('ballot=0 promised=0 no promise', shouldPromise(0, 0) === false,
  'got ' + shouldPromise(0, 0));

// Higher ballot always promises when above current
assert('ballot=4 promised=3 does promise', shouldPromise(4, 3) === true,
  'got ' + shouldPromise(4, 3));

// Strictly less: never promises
assert('ballot=2 promised=3 no promise', shouldPromise(2, 3) === false,
  'got ' + shouldPromise(2, 3));

process.exit(failed > 0 ? 1 : 0);
