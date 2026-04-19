'use strict';
var { detectConflict } = require('../../../bin/bench-buggy-extreme-write-skew.cjs');
var failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// Classic write skew: T1 reads {A,B} and writes {A}; T2 reads {A,B} and writes {B}.
// Write-write overlap: none (T1 writes A, T2 writes B → no overlap).
// Read-write anti-dependency: T2 writes B ∩ T1 reads {A,B} = {B} → conflict.
//                             T1 writes A ∩ T2 reads {A,B} = {A} → conflict.
// Correct: detectConflict returns true. Buggy: returns false (no write-write overlap).
assert('write skew detected (T1:read={A,B},write={A} T2:read={A,B},write={B})',
  detectConflict(['A', 'B'], ['A'], ['A', 'B'], ['B']) === true,
  'detectConflict returned false — write skew anomaly missed (only dirty write checked)');

// Dirty write: T1 writes {A}, T2 writes {A} — write-write overlap → conflict.
assert('dirty write detected', detectConflict(['A'], ['A'], ['B'], ['A']) === true, 'got false');

// No conflict: disjoint read and write sets.
assert('no conflict: all disjoint', detectConflict(['A'], ['B'], ['C'], ['D']) === false, 'got true');

// Write skew variant: T1 reads {X,Y} writes {X}; T2 reads {Y,Z} writes {Z}.
// T1 writes X; T2 reads {Y,Z}: X not in {Y,Z} → no anti-dep from T1.
// T2 writes Z; T1 reads {X,Y}: Z not in {X,Y} → no anti-dep from T2.
// Correct: no conflict. Buggy: no conflict (matches correct here).
assert('truly disjoint write skew test: no conflict', detectConflict(['X','Y'],['X'],['Y','Z'],['Z']) === false,
  'got true');

// Write skew with single shared read key:
// T1 reads {K}, writes {A}. T2 reads {K}, writes {B}.
// T1 writes A ∩ T2 reads {K}: empty. T2 writes B ∩ T1 reads {K}: empty.
// Correct: no anti-dependency conflict (A and B not in each other's read sets).
assert('no conflict when writes not in other read sets', detectConflict(['K'],['A'],['K'],['B']) === false,
  'got true');

// T1 writes {K}, T2 reads {K}: anti-dependency conflict.
// T1: read={}, write={K}. T2: read={K}, write={}.
assert('write-read anti-dependency: T1 writes K, T2 reads K',
  detectConflict([], ['K'], ['K'], []) === true,
  'detectConflict returned false — anti-dependency missed');

// Exhaustive: all combinations where exactly one anti-dep exists
var items = ['A', 'B', 'C'];
// T1 writes A, T2 reads A (anti-dep T1→T2): conflict
assert('anti-dep T1 write A, T2 read A',
  detectConflict([], ['A'], ['A'], ['B']) === true,
  'missed T1.write ∩ T2.read anti-dependency');
// T2 writes B, T1 reads B (anti-dep T2→T1): conflict
assert('anti-dep T2 write B, T1 read B',
  detectConflict(['B'], ['A'], [], ['B']) === true,
  'missed T2.write ∩ T1.read anti-dependency');

process.exit(failed > 0 ? 1 : 0);
