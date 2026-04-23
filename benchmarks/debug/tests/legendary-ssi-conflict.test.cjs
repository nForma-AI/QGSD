'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-ssi-conflict.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// rw-antidependency: T1 reads something T2 writes
// T3 reads C, T4 writes C. T3 does NOT write anything T4 reads.
var T3 = {readSet: ['C'], writeSet: ['D']};
var T4 = {readSet: ['E'], writeSet: ['C']};
// Correct: T3 reads C, T4 writes C → rw conflict T3→T4 = true
// Buggy: checks T3 writes D ∩ T4 reads E = {} → false
assert('rw conflict T3→T4 (T3 reads C, T4 writes C)', f(T3, T4), true);

// No rw conflict: T1 reads X, T2 writes Y (different keys)
var T5 = {readSet: ['X'], writeSet: ['Y']};
var T6 = {readSet: ['P'], writeSet: ['Q']};
assert('no conflict (disjoint keys)', f(T5, T6), false);

// T7 reads A,B; T8 writes B,C → rw conflict on B
var T7 = {readSet: ['A','B'], writeSet: ['D']};
var T8 = {readSet: ['E'], writeSet: ['B','C']};
assert('rw conflict on B', f(T7, T8), true);

// wr-dependency (the bug direction): T9 writes A, T10 reads A — that is NOT an rw-antidependency from T9 perspective
// f(T9, T10) should be false (T9 doesn't READ anything T10 WRITES)
var T9 = {readSet: [], writeSet: ['A']};
var T10 = {readSet: ['A'], writeSet: []};
// rw check: T9 reads nothing → no rw from T9 to T10 → false
assert('wr is not rw-antidependency', f(T9, T10), false);
// Buggy: T9 writes A, T10 reads A → buggy returns true (incorrect)

process.exit(failed > 0 ? 1 : 0);
