'use strict';
const { f } = require('../../../bin/bench-buggy-medium-deep-equal.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

assert('nested equal', f({x:{y:1}},{x:{y:1}}), true);
assert('nested unequal', f({x:{y:1}},{x:{y:2}}), false);
assert('flat equal', f({a:1},{a:1}), true);

process.exit(failed > 0 ? 1 : 0);
