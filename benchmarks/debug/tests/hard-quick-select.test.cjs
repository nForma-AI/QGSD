'use strict';
const { f } = require('../../../bin/bench-buggy-hard-quick-select.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// 0th smallest of [5,3,1,4,2] is 1; buggy: returns 2nd smallest = 2
assert('0th smallest', f([5, 3, 1, 4, 2], 0), 1);
// 1st smallest of [5,3,1,4,2] is 2; buggy: returns 3rd smallest = 3
assert('1st smallest', f([5, 3, 1, 4, 2], 1), 2);
// 2nd smallest of [5,3,1,4,2] is 3; buggy: returns 4th smallest = 4
assert('2nd smallest', f([5, 3, 1, 4, 2], 2), 3);
// 4th smallest (last) of [5,3,1,4,2] is 5; buggy: returns a[b+1=5] out of bounds → undefined
assert('4th smallest (last)', f([5, 3, 1, 4, 2], 4), 5);

process.exit(failed > 0 ? 1 : 0);
