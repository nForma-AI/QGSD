'use strict';
const { f } = require('../../../bin/bench-buggy-count-occurrences.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('string vs number', f([1, '1', 1], 1) === 2, 'got ' + f([1, '1', 1], 1));
assert('exact match', f([1, 2, 1, 3], 1) === 2, 'got ' + f([1, 2, 1, 3], 1));
process.exit(failed > 0 ? 1 : 0);
