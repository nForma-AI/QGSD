'use strict';
const { deepEqual } = require('../../../bin/bench-buggy-medium-deep-equal.cjs');
let failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}

assert('nested equal', deepEqual({x:{y:1}},{x:{y:1}}), true);
assert('nested unequal', deepEqual({x:{y:1}},{x:{y:2}}), false);
assert('flat equal', deepEqual({a:1},{a:1}), true);

process.exit(failed > 0 ? 1 : 0);
