'use strict';
var { f } = require('../../../bin/bench-buggy-extreme-total-order-broadcast.cjs');
var failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Invariant: total order broadcast requires IDENTICAL delivery sequences across all processes.
// Set equality (same messages) is NOT sufficient — order must match too.

// Different order: NOT consistent (different total orders observed)
assert('different order [A,B,C] vs [A,C,B]: inconsistent',
  f([['A','B','C'], ['A','C','B']]) === false,
  'returned true — sort erased order difference, set equality substituted for order equality');

assert('different order [A,B] vs [B,A]: inconsistent',
  f([['A','B'], ['B','A']]) === false,
  'returned true — [A,B] and [B,A] have same elements but different total orders');

assert('different order [X,Y,Z] vs [Z,Y,X]: inconsistent',
  f([['X','Y','Z'], ['Z','Y','X']]) === false,
  'returned true — reverse order not detected');

// Three processes with mixed ordering
assert('3 processes mixed order: inconsistent',
  f([['A','B','C'], ['A','B','C'], ['A','C','B']]) === false,
  'returned true — one differing process not caught');

// Same order: consistent
assert('same order [A,B]: consistent', f([['A','B'], ['A','B']]) === true, 'got false');
assert('same order [A,B,C] x3: consistent',
  f([['A','B','C'],['A','B','C'],['A','B','C']]) === true, 'got false');

// Different messages: inconsistent (even sets differ)
assert('different messages [A,B] vs [A,C]: inconsistent',
  f([['A','B'], ['A','C']]) === false, 'got true');

// Empty logs: consistent
assert('empty logs: consistent', f([[], []]) === true, 'got false');
assert('no logs: consistent', f([]) === true, 'got false');

// Single process: always consistent with itself
assert('single process: consistent', f([['A','B','C']]) === true, 'got false');

// Single message: order doesn't matter (only 1 element)
assert('single message same: consistent', f([['A'], ['A']]) === true, 'got false');

// Enumerate all permutations of [1,2,3]: any two different permutations are inconsistent
var perms = [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]];
for (var i = 0; i < perms.length; i++) {
  for (var j = 0; j < perms.length; j++) {
    var expected = i === j;
    var got = f([perms[i], perms[j]]);
    assert(
      'perms[' + i + '] vs perms[' + j + ']: ' + JSON.stringify(perms[i]) + ' ' + JSON.stringify(perms[j]),
      got === expected,
      'expected ' + expected + ' got ' + got
    );
  }
}

process.exit(failed > 0 ? 1 : 0);
