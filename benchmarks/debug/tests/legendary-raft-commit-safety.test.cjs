'use strict';
const { canCommit } = require('../../../bin/bench-buggy-legendary-raft-commit-safety.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// Raft Figure 8 scenario: trying to commit an old-term entry is unsafe.
// Leader in term=3 cannot commit a term=2 entry by counting — must only commit current-term entries.
var log = [{term:1,value:'A'},{term:2,value:'B'}];
var currentTerm = 3;
var replicaCount = 3;
var clusterSize = 5;

// The last entry in log has term=2, not currentTerm=3. Must not commit.
assert('cannot commit old-term entry directly', canCommit(log, currentTerm, replicaCount, clusterSize), false);

// With a current-term entry at the end, committing IS safe
var safeLog = [{term:1,value:'A'},{term:2,value:'B'},{term:3,value:'C'}];
assert('can commit current-term entry', canCommit(safeLog, currentTerm, replicaCount, clusterSize), true);

// Below majority — never commit regardless
assert('below majority not committed', canCommit(safeLog, currentTerm, 2, clusterSize), false);

process.exit(failed > 0 ? 1 : 0);
