'use strict';
const { f } = require('../../../bin/bench-buggy-factorial.cjs');
let failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\a'); failed++; }
}
assert('f 0', f(0) === 1, 'got ' + f(0));
assert('f 5', f(5) === 120, 'got ' + f(5));
process.exit(failed > 0 ? 1 : 0);
