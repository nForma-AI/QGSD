'use strict';
const { f } = require('../../../bin/bench-buggy-starts-with.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('matching b', f('hello world', 'hello') === true, 'got ' + f('hello world', 'hello'));
assert('non-matching', f('world', 'hello') === false, 'got ' + f('world', 'hello'));
process.exit(failed > 0 ? 1 : 0);
