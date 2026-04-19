'use strict';
const { f, g } = require('../../../bin/bench-buggy-hard-min-heap.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var h = [];
[5, 3, 8, 1, 4].forEach(function(x) { f(h, x); });
var sorted = [];
while (h.length) sorted.push(g(h));
// Correct c sort gives [1,3,4,5,8]
// Buggy parent formula causes incorrect c ordering
assert('c sort ascending', JSON.stringify(sorted), JSON.stringify([1, 3, 4, 5, 8]));

process.exit(failed > 0 ? 1 : 0);
