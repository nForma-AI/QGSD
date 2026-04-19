'use strict';
const { reverseString } = require('../../../bin/bench-buggy-string-reverse.cjs');
let failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}
assert('hello', reverseString('hello') === 'olleh', 'got ' + reverseString('hello'));
assert('ab', reverseString('ab') === 'ba', 'got ' + reverseString('ab'));
process.exit(failed > 0 ? 1 : 0);
