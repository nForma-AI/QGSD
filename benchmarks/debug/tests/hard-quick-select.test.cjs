'use strict';
const { quickSelect } = require('../../../bin/bench-buggy-hard-quick-select.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (actual !== expected) {
    process.stderr.write('FAIL ' + label + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual) + '\n');
    failed++;
  }
}

// 0th smallest of [5,3,1,4,2] is 1; buggy: returns 2nd smallest = 2
assert('0th smallest', quickSelect([5, 3, 1, 4, 2], 0), 1);
// 1st smallest of [5,3,1,4,2] is 2; buggy: returns 3rd smallest = 3
assert('1st smallest', quickSelect([5, 3, 1, 4, 2], 1), 2);
// 2nd smallest of [5,3,1,4,2] is 3; buggy: returns 4th smallest = 4
assert('2nd smallest', quickSelect([5, 3, 1, 4, 2], 2), 3);
// 4th smallest (last) of [5,3,1,4,2] is 5; buggy: returns arr[k+1=5] out of bounds → undefined
assert('4th smallest (last)', quickSelect([5, 3, 1, 4, 2], 4), 5);

process.exit(failed > 0 ? 1 : 0);
