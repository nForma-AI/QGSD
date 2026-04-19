'use strict';
const { range } = require('../../../bin/bench-buggy-range.cjs');
let failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}
assert('range 0-3', JSON.stringify(range(0, 3)) === JSON.stringify([0, 1, 2]), 'got ' + JSON.stringify(range(0, 3)));
assert('range 1-4', JSON.stringify(range(1, 4)) === JSON.stringify([1, 2, 3]), 'got ' + JSON.stringify(range(1, 4)));
process.exit(failed > 0 ? 1 : 0);
