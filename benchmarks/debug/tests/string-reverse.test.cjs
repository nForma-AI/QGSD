'use strict';
const { f } = require('../../../bin/bench-buggy-string-reverse.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('hello', f('hello') === 'olleh', 'got ' + f('hello'));
assert('ab', f('ab') === 'ba', 'got ' + f('ab'));
process.exit(failed > 0 ? 1 : 0);
