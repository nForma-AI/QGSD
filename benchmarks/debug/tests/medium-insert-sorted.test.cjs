'use strict';
const { insertSorted } = require('../../../bin/bench-buggy-medium-insert-sorted.cjs');
let failed = 0;
function assert(label, got, expected) {
  if (got !== expected) { process.stderr.write('FAIL ' + label + ': got ' + got + ', expected ' + expected + '\n'); failed++; }
}

assert('insert into middle', JSON.stringify(insertSorted([1,3,5], 4)), JSON.stringify([1,3,4,5]));
assert('insert at end', JSON.stringify(insertSorted([1,2,3], 5)), JSON.stringify([1,2,3,5]));
assert('insert at start', JSON.stringify(insertSorted([2,4,6], 1)), JSON.stringify([1,2,4,6]));

process.exit(failed > 0 ? 1 : 0);
