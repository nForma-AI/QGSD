'use strict';
const { canPrewrite } = require('../../../bin/bench-buggy-legendary-percolator-write-conflict.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

var lockTable = {key1: 'txn-A'};

// Blocked by another transaction's lock
assert('blocked by other txn lock', canPrewrite('key1', 'txn-B', lockTable), false);

// Own lock on key1 also blocks (shouldn't re-prewrite an already-locked key)
assert('blocked even by own lock', canPrewrite('key1', 'txn-A', lockTable), false);

// No lock → can write
assert('no lock: can write', canPrewrite('key2', 'txn-B', lockTable), true);

// Empty lock table
assert('empty lock table: can write', canPrewrite('key3', 'txn-C', {}), true);

process.exit(failed > 0 ? 1 : 0);
