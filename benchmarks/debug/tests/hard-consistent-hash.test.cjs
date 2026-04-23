'use strict';
const { f, g } = require('../../../bin/bench-buggy-hard-consistent-hash.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// g('A') = 65, g('B') = 66, g('C') = 67
// g('~') = 126 (charCode 126)
// 126 > 67 → loop exhausts → buggy: returns null, correct: returns 'A' (ring[0], lowest hash)
var a = ['A', 'B', 'C'];
assert('high hash b wraps to first node', f(a, '~'), 'A');
assert('normal lookup works', f(a, 'A'), 'A'); // hash 65 >= 65 → 'A'
assert('b hashing between a', f(a, 'B'), 'B'); // hash 66 >= 66 → 'B'

// Verify the bug: a b with hash above all a should NOT return null
var result = f(a, '~');
assert('result is not null', result !== null, true);

process.exit(failed > 0 ? 1 : 0);
