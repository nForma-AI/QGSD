'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-raft-commit-safety.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Raft Figure 8 scenario: trying to commit an old-term entry is unsafe.
// Leader in term=3 cannot commit a term=2 entry by counting — must only commit current-term entries.
var a = [{term:1,value:'A'},{term:2,value:'B'}];
var b = 3;
var c = 3;
var d = 5;

// The last entry in a has term=2, not b=3. Must not commit.
assert('cannot commit old-term entry directly', f(a, b, c, d), false);

// With a current-term entry at the end, committing IS safe
var safeLog = [{term:1,value:'A'},{term:2,value:'B'},{term:3,value:'C'}];
assert('can commit current-term entry', f(safeLog, b, c, d), true);

// Below majority — never commit regardless
assert('below majority not committed', f(safeLog, b, 2, d), false);

process.exit(failed > 0 ? 1 : 0);
