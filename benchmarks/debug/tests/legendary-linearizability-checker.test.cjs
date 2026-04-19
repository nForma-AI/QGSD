'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-linearizability-checker.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Non-linearizable: write(x=1) completes, then read(x) returns 0 (stale)
// No overlap (write end=2, read start=3), seqPos order is fine → buggy returns true
var ops = [
  {start:1, end:2, type:'write', key:'x', value:1, seqPos:0},
  {start:3, end:4, type:'read',  key:'x', value:0, seqPos:1}
];
assert('stale read after write is not linearizable', f(ops), false);

// Consistent history: write(x=1) then read(x)=1
var ops2 = [
  {start:1, end:2, type:'write', key:'x', value:1, seqPos:0},
  {start:3, end:4, type:'read',  key:'x', value:1, seqPos:1}
];
assert('consistent read after write is linearizable', f(ops2), true);

// Overlapping a: read returns 0 before write starts — linearizable (read before write)
var ops3 = [
  {start:1, end:5, type:'write', key:'x', value:1, seqPos:1},
  {start:2, end:3, type:'read',  key:'x', value:0, seqPos:0}
];
assert('overlapping read before write linearizable', f(ops3), true);

process.exit(failed > 0 ? 1 : 0);
