'use strict';
const { average } = require('../../../bin/bench-buggy-average.cjs');
let failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}
assert('basic average', average([2, 4, 6]) === 4, 'got ' + average([2, 4, 6]));
assert('single element', average([10]) === 10, 'got ' + average([10]));
process.exit(failed > 0 ? 1 : 0);
