'use strict';
const { chunk } = require('../../../bin/bench-buggy-chunk.cjs');
let failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}
assert('chunk 3 by 2', JSON.stringify(chunk([1, 2, 3, 4], 2)) === JSON.stringify([[1, 2], [3, 4]]), 'got ' + JSON.stringify(chunk([1, 2, 3, 4], 2)));
assert('chunk 4 by 2', JSON.stringify(chunk([1, 2, 3, 4, 5, 6], 2)) === JSON.stringify([[1, 2], [3, 4], [5, 6]]), 'got ' + JSON.stringify(chunk([1, 2, 3, 4, 5, 6], 2)));
process.exit(failed > 0 ? 1 : 0);
