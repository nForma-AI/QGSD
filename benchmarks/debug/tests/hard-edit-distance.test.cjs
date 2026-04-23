'use strict';
const { f } = require('../../../bin/bench-buggy-hard-edit-distance.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// 'cat' -> 'bat': one substitution, should be distance 1, buggy returns 2
assert('one substitution', f('cat', 'bat'), 1);
assert('insertions only', f('', 'abc'), 3);
assert('same string', f('hello', 'hello'), 0);
// 'ab' -> 'cd': two substitutions, should be 2, buggy returns 4
assert('two substitutions', f('ab', 'cd'), 2);

process.exit(failed > 0 ? 1 : 0);
