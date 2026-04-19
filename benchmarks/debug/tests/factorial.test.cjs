'use strict';
const { factorial } = require('../../../bin/bench-buggy-factorial.cjs');
let failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}
assert('factorial 0', factorial(0) === 1, 'got ' + factorial(0));
assert('factorial 5', factorial(5) === 120, 'got ' + factorial(5));
process.exit(failed > 0 ? 1 : 0);
