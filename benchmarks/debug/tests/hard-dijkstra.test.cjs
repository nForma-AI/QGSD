'use strict';
const { dijkstra } = require('../../../bin/bench-buggy-hard-dijkstra.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// Graph: A->B(1), A->C(4), B->C(2), B->D(5), C->D(1)
// Shortest: A=0, B=1, C=3 (via B), D=4 (via B->C)
var graph = {
  'A': [['B', 1], ['C', 4]],
  'B': [['C', 2], ['D', 5]],
  'C': [['D', 1]],
  'D': []
};
var d = dijkstra(graph, 'A');
assert('A to B', d['B'], 1);
assert('A to C via B', d['C'], 3);
assert('A to D via B->C', d['D'], 4);

process.exit(failed > 0 ? 1 : 0);
