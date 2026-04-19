'use strict';
const { removeFalsy } = require('../../../bin/bench-buggy-remove-falsy.cjs');
let failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}
assert('removes null', removeFalsy([1, null, 2]).length === 2, 'got ' + removeFalsy([1, null, 2]).length);
assert('removes zero', removeFalsy([0, 1, 2]).length === 2, 'got ' + removeFalsy([0, 1, 2]).length);
assert('keeps truthy', JSON.stringify(removeFalsy([1, 'a', true])) === JSON.stringify([1, 'a', true]), 'got ' + JSON.stringify(removeFalsy([1, 'a', true])));
process.exit(failed > 0 ? 1 : 0);
