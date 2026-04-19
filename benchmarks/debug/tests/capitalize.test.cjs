'use strict';
const { f } = require('../../../bin/bench-buggy-capitalize.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('hello', f('hello') === 'Hello', 'got ' + f('hello'));
assert('ab', f('ab') === 'Ab', 'got ' + f('ab'));
process.exit(failed > 0 ? 1 : 0);
