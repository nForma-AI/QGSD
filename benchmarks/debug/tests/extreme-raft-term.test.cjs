'use strict';
var { f } = require('../../../bin/bench-buggy-extreme-raft-term.cjs');
var failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Formal invariant: f(cur, recv) iff recv > cur.
// Exhaustive enumeration over all (cur, recv) pairs in [1..6]:
for (var cur = 1; cur <= 6; cur++) {
  for (var recv = 1; recv <= 6; recv++) {
    var expected = recv > cur;
    var got = f(cur, recv);
    assert(
      'f(cur=' + cur + ',recv=' + recv + ')',
      got === expected,
      'expected ' + expected + ' got ' + got
    );
  }
}

// Critical safety property: leader at term 3 receiving message from term 4 MUST step down.
assert('step down for higher term', f(3, 4) === true,
  'f(3,4) returned false — stale leader persists with higher term present');

// Critical: leader at term 3 receiving message from same term must NOT step down.
assert('no step down for equal term', f(3, 3) === false,
  'f(3,3) returned true — leader incorrectly stepped down for equal term');

// Critical: leader at term 4 receiving message from term 3 must NOT step down.
assert('no step down for lower term', f(4, 3) === false,
  'f(4,3) returned true — leader incorrectly yielded to stale term');

// Dual-leader scenario: two leaders at terms 2 and 3.
// Leader at term 2 sees term 3 → must step down (only one leader should remain).
assert('dual leader resolved by step down', f(2, 3) === true,
  'f(2,3) returned false — dual leadership not resolved');

process.exit(failed > 0 ? 1 : 0);
