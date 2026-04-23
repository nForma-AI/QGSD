'use strict';
const { f } = require('../../../bin/bench-buggy-remove-falsy.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('removes null', f([1, null, 2]).length === 2, 'got ' + f([1, null, 2]).length);
assert('removes zero', f([0, 1, 2]).length === 2, 'got ' + f([0, 1, 2]).length);
assert('keeps truthy', JSON.stringify(f([1, 'a', true])) === JSON.stringify([1, 'a', true]), 'got ' + JSON.stringify(f([1, 'a', true])));
process.exit(failed > 0 ? 1 : 0);
