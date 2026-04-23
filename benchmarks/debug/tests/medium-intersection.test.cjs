'use strict';
const { f } = require('../../../bin/bench-buggy-medium-intersection.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

assert('basic f', JSON.stringify(f([1,2,3],[2,3,4])), JSON.stringify([2,3]));
assert('no duplicates from a', JSON.stringify(f([1,1,2],[1])), JSON.stringify([1]));

process.exit(failed > 0 ? 1 : 0);
