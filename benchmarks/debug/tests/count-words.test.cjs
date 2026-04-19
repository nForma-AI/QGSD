'use strict';
const { f } = require('../../../bin/bench-buggy-count-words.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('single spaces', f('hello world') === 2, 'got ' + f('hello world'));
assert('multiple spaces', f('hello  world  foo') === 3, 'got ' + f('hello  world  foo'));
assert('leading space', f('  hello') === 1, 'got ' + f('  hello'));
process.exit(failed > 0 ? 1 : 0);
