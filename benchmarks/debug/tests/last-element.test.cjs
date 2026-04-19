'use strict';
const { lastElement } = require('../../../bin/bench-buggy-last-element.cjs');
let failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}
assert('three items', lastElement([1, 2, 3]) === 3, 'got ' + lastElement([1, 2, 3]));
assert('single item', lastElement([42]) === 42, 'got ' + lastElement([42]));
process.exit(failed > 0 ? 1 : 0);
