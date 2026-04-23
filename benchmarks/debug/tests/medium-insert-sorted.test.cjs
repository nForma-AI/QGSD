'use strict';
const { f } = require('../../../bin/bench-buggy-medium-insert-sorted.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

assert('insert into middle', JSON.stringify(f([1,3,5], 4)), JSON.stringify([1,3,4,5]));
assert('insert at end', JSON.stringify(f([1,2,3], 5)), JSON.stringify([1,2,3,5]));
assert('insert at start', JSON.stringify(f([2,4,6], 1)), JSON.stringify([1,2,4,6]));

process.exit(failed > 0 ? 1 : 0);
