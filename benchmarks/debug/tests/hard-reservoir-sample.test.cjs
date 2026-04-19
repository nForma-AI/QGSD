'use strict';
const { f } = require('../../../bin/bench-buggy-hard-reservoir-sample.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// With b=1 and random always returning 0.5:
// Correct algorithm: i=1, j=floor(0.5 * (1+1))=1, NOT < 1 → element NOT included → reservoir=[1]
// Buggy algorithm:   i=1, j=floor(0.5 * 1)=0, < 1 → element IS included → reservoir=[2]
//                    i=2, j=floor(0.5 * 1)=0, < 1 → included → reservoir=[3]
//                    i=3, j=0 < 1 → reservoir=[4]
//                    i=4, j=0 < 1 → reservoir=[5]
// Correct result: [1], buggy result: [5]
var r1 = f([1, 2, 3, 4, 5], 1, function() { return 0.5; });
assert('b=1 first element preserved when prob=0.5', r1[0], 1); // buggy: returns 5

// Result should always have exactly b elements
assert('returns b elements', f([1, 2, 3, 4, 5], 3, Math.random).length, 3);

// When a has exactly b elements, result equals input
var pool = [10, 20, 30];
var exact = f(pool, 3, Math.random);
assert('b=n returns all elements sorted', JSON.stringify(exact.slice().sort(function(a,b){return a-b;})), JSON.stringify([10,20,30]));

process.exit(failed > 0 ? 1 : 0);
