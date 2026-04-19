'use strict';
const { reservoirSample } = require('../../../bin/bench-buggy-hard-reservoir-sample.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// With k=1 and random always returning 0.5:
// Correct algorithm: i=1, j=floor(0.5 * (1+1))=1, NOT < 1 → element NOT included → reservoir=[1]
// Buggy algorithm:   i=1, j=floor(0.5 * 1)=0, < 1 → element IS included → reservoir=[2]
//                    i=2, j=floor(0.5 * 1)=0, < 1 → included → reservoir=[3]
//                    i=3, j=0 < 1 → reservoir=[4]
//                    i=4, j=0 < 1 → reservoir=[5]
// Correct result: [1], buggy result: [5]
var r1 = reservoirSample([1, 2, 3, 4, 5], 1, function() { return 0.5; });
assert('k=1 first element preserved when prob=0.5', r1[0], 1); // buggy: returns 5

// Result should always have exactly k elements
assert('returns k elements', reservoirSample([1, 2, 3, 4, 5], 3, Math.random).length, 3);

// When stream has exactly k elements, result equals input
var pool = [10, 20, 30];
var exact = reservoirSample(pool, 3, Math.random);
assert('k=n returns all elements sorted', JSON.stringify(exact.slice().sort(function(a,b){return a-b;})), JSON.stringify([10,20,30]));

process.exit(failed > 0 ? 1 : 0);
