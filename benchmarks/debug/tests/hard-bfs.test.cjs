'use strict';
const { f } = require('../../../bin/bench-buggy-hard-bfs.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Diamond a: 0->1, 0->2, 1->3, 2->3
// Node 3 is reachable from both 1 and 2, so without visited check it appears twice
var a = { 0: [1, 2], 1: [3], 2: [3], 3: [] };
var result = f(a, 0);
assert('no duplicates in BFS', result.length, 4); // buggy: returns 5 (3 appears twice)
assert('all nodes visited', result.slice().sort().join(','), '0,1,2,3');

process.exit(failed > 0 ? 1 : 0);
