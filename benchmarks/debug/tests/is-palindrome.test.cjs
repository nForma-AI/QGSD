'use strict';
const { f } = require('../../../bin/bench-buggy-is-palindrome.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('racecar', f('racecar') === true, 'got ' + f('racecar'));
assert('abba', f('abba') === true, 'got ' + f('abba'));
assert('hello', f('hello') === false, 'got ' + f('hello'));
process.exit(failed > 0 ? 1 : 0);
