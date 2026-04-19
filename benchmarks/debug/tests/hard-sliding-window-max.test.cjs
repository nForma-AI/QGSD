'use strict';
const { slidingWindowMax } = require('../../../bin/bench-buggy-hard-sliding-window-max.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

assert('basic window max', JSON.stringify(slidingWindowMax([1, 3, -1, -3, 5, 3, 6, 7], 3)), JSON.stringify([3, 3, 5, 5, 6, 7]));
assert('window of 1', JSON.stringify(slidingWindowMax([1, 2, 3], 1)), JSON.stringify([1, 2, 3]));
assert('window equals array length', JSON.stringify(slidingWindowMax([4, 2, 7], 3)), JSON.stringify([7]));

process.exit(failed > 0 ? 1 : 0);
