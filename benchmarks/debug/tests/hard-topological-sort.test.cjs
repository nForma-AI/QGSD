'use strict';
const { f } = require('../../../bin/bench-buggy-hard-topological-sort.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

assert('acyclic sort', JSON.stringify(f(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']])), JSON.stringify(['a', 'b', 'c']));
// Graph: a->b->c->a (cycle) plus d->a
// inDegree: a=2 (from c and d), b=1, c=1, d=0
// queue starts with [d], processes d, decrements inDegree[a] to 1 → never reaches 0
// result = ['d'], length=1 !== a.length=4 → should return []
// buggy: returns ['d']
assert('cycle returns empty array', JSON.stringify(f(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'a'], ['d', 'a']])), JSON.stringify([]));

process.exit(failed > 0 ? 1 : 0);
