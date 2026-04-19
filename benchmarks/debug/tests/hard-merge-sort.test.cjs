'use strict';
const { f } = require('../../../bin/bench-buggy-hard-merge-sort.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Equal elements get dropped: [3,1,2,1,3] should produce [1,1,2,3,3]
// buggy: produces [1,2,3] (duplicates lost)
assert('sorts with duplicates', JSON.stringify(f([3, 1, 2, 1, 3])), JSON.stringify([1, 1, 2, 3, 3]));
assert('basic sort no dups', JSON.stringify(f([3, 1, 2])), JSON.stringify([1, 2, 3]));
assert('already sorted', JSON.stringify(f([1, 2, 3])), JSON.stringify([1, 2, 3]));

process.exit(failed > 0 ? 1 : 0);
