'use strict';
const { factorial } = require('../../../bin/bench-buggy-factorial.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('factorial 0', factorial(0) === 1, 'got ' + factorial(0));
assert('factorial 5', factorial(5) === 120, 'got ' + factorial(5));
process.exit(failed > 0 ? 1 : 0);
