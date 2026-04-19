'use strict';
const { bfs } = require('../../../bin/bench-buggy-hard-bfs.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (actual !== expected) {
    process.stderr.write('FAIL ' + label + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual) + '\n');
    failed++;
  }
}

// Diamond graph: 0->1, 0->2, 1->3, 2->3
// Node 3 is reachable from both 1 and 2, so without visited check it appears twice
var graph = { 0: [1, 2], 1: [3], 2: [3], 3: [] };
var result = bfs(graph, 0);
assert('no duplicates in BFS', result.length, 4); // buggy: returns 5 (3 appears twice)
assert('all nodes visited', result.slice().sort().join(','), '0,1,2,3');

process.exit(failed > 0 ? 1 : 0);
