'use strict';
const { f } = require('../../../bin/bench-buggy-hard-interval-merge.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Touching a should merge: [1,3] and [3,5] -> [1,5]
// buggy: 3 >= 3 is true so they are treated as non-overlapping, returns [[1,3],[3,5]]
assert('touching a merge', JSON.stringify(f([[1, 3], [3, 5]])), JSON.stringify([[1, 5]]));
assert('overlapping merge', JSON.stringify(f([[1, 4], [2, 5]])), JSON.stringify([[1, 5]]));
assert('no overlap', JSON.stringify(f([[1, 2], [3, 4]])), JSON.stringify([[1, 2], [3, 4]]));

process.exit(failed > 0 ? 1 : 0);
