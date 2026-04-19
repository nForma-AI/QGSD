'use strict';
const { heapPush, heapPop } = require('../../../bin/bench-buggy-hard-min-heap.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (actual !== expected) {
    process.stderr.write('FAIL ' + label + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual) + '\n');
    failed++;
  }
}

var h = [];
[5, 3, 8, 1, 4].forEach(function(x) { heapPush(h, x); });
var sorted = [];
while (h.length) sorted.push(heapPop(h));
// Correct heap sort gives [1,3,4,5,8]
// Buggy parent formula causes incorrect heap ordering
assert('heap sort ascending', JSON.stringify(sorted), JSON.stringify([1, 3, 4, 5, 8]));

process.exit(failed > 0 ? 1 : 0);
