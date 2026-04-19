'use strict';
const { mergeIntervals } = require('../../../bin/bench-buggy-hard-interval-merge.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (actual !== expected) {
    process.stderr.write('FAIL ' + label + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual) + '\n');
    failed++;
  }
}

// Touching intervals should merge: [1,3] and [3,5] -> [1,5]
// buggy: 3 >= 3 is true so they are treated as non-overlapping, returns [[1,3],[3,5]]
assert('touching intervals merge', JSON.stringify(mergeIntervals([[1, 3], [3, 5]])), JSON.stringify([[1, 5]]));
assert('overlapping merge', JSON.stringify(mergeIntervals([[1, 4], [2, 5]])), JSON.stringify([[1, 5]]));
assert('no overlap', JSON.stringify(mergeIntervals([[1, 2], [3, 4]])), JSON.stringify([[1, 2], [3, 4]]));

process.exit(failed > 0 ? 1 : 0);
