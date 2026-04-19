'use strict';
const { startsWith } = require('../../../bin/bench-buggy-starts-with.cjs');
let failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}
assert('matching prefix', startsWith('hello world', 'hello') === true, 'got ' + startsWith('hello world', 'hello'));
assert('non-matching', startsWith('world', 'hello') === false, 'got ' + startsWith('world', 'hello'));
process.exit(failed > 0 ? 1 : 0);
