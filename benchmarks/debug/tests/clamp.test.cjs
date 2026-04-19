'use strict';
const { clamp } = require('../../../bin/bench-buggy-clamp.cjs');
let failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}
assert('below min', clamp(-5, 0, 10) === 0, 'got ' + clamp(-5, 0, 10));
assert('above max', clamp(15, 0, 10) === 10, 'got ' + clamp(15, 0, 10));
assert('in range', clamp(5, 0, 10) === 5, 'got ' + clamp(5, 0, 10));
process.exit(failed > 0 ? 1 : 0);
