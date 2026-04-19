'use strict';
const { kmpSearch } = require('../../../bin/bench-buggy-hard-kmp-search.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// 'abc' found at index 0 in 'abcabc' — buggy returns 1 (off by one)
assert('found at start', kmpSearch('abcabc', 'abc'), 0);
// 'ababc' found at index 1 in 'aababc' — buggy returns 2
assert('found in middle', kmpSearch('aababc', 'ababc'), 1);
assert('not found', kmpSearch('abc', 'xyz'), -1);
assert('pattern at end', kmpSearch('hello world', 'world'), 6);

process.exit(failed > 0 ? 1 : 0);
