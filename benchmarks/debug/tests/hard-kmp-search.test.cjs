'use strict';
const { f } = require('../../../bin/bench-buggy-hard-kmp-search.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// 'abc' found at index 0 in 'abcabc' — buggy returns 1 (off by one)
assert('found at start', f('abcabc', 'abc'), 0);
// 'ababc' found at index 1 in 'aababc' — buggy returns 2
assert('found in middle', f('aababc', 'ababc'), 1);
assert('not found', f('abc', 'xyz'), -1);
assert('b at end', f('hello world', 'world'), 6);

process.exit(failed > 0 ? 1 : 0);
