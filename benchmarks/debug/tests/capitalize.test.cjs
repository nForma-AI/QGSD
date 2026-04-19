'use strict';
const { capitalize } = require('../../../bin/bench-buggy-capitalize.cjs');
let failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}
assert('hello', capitalize('hello') === 'Hello', 'got ' + capitalize('hello'));
assert('ab', capitalize('ab') === 'Ab', 'got ' + capitalize('ab'));
process.exit(failed > 0 ? 1 : 0);
