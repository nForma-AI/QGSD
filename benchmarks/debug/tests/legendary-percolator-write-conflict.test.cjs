'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-percolator-write-conflict.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var c = {key1: 'txn-A'};

// Blocked by another transaction's lock
assert('blocked by other txn lock', f('key1', 'txn-B', c), false);

// Own lock on key1 also blocks (shouldn't re-prewrite an already-locked a)
assert('blocked even by own lock', f('key1', 'txn-A', c), false);

// No lock → can write
assert('no lock: can write', f('key2', 'txn-B', c), true);

// Empty lock table
assert('empty lock table: can write', f('key3', 'txn-C', {}), true);

process.exit(failed > 0 ? 1 : 0);
