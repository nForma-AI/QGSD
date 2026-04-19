'use strict';
const { countOccurrences } = require('../../../bin/bench-buggy-count-occurrences.cjs');
let failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}
assert('string vs number', countOccurrences([1, '1', 1], 1) === 2, 'got ' + countOccurrences([1, '1', 1], 1));
assert('exact match', countOccurrences([1, 2, 1, 3], 1) === 2, 'got ' + countOccurrences([1, 2, 1, 3], 1));
process.exit(failed > 0 ? 1 : 0);
