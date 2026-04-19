'use strict';
const { editDistance } = require('../../../bin/bench-buggy-hard-edit-distance.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// 'cat' -> 'bat': one substitution, should be distance 1, buggy returns 2
assert('one substitution', editDistance('cat', 'bat'), 1);
assert('insertions only', editDistance('', 'abc'), 3);
assert('same string', editDistance('hello', 'hello'), 0);
// 'ab' -> 'cd': two substitutions, should be 2, buggy returns 4
assert('two substitutions', editDistance('ab', 'cd'), 2);

process.exit(failed > 0 ? 1 : 0);
