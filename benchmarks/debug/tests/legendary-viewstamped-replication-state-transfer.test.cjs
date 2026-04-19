'use strict';
const { getStateTransfer } = require('../../../bin/bench-buggy-legendary-viewstamped-replication-state-transfer.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

var log = [{opNum:1,val:'a'},{opNum:2,val:'b'},{opNum:3,val:'c'}];
var transfer = getStateTransfer(log, 3);  // last committed op is op#3
assert('includes last committed op (length=3)', transfer.length, 3);
assert('op 3 included', transfer.some(function(e){return e.opNum===3;}), true);

// Also test boundary
var transfer2 = getStateTransfer(log, 2);
assert('includes up to lastCommitted=2', transfer2.length, 2);
assert('op 2 included when lastCommitted=2', transfer2.some(function(e){return e.opNum===2;}), true);

process.exit(failed > 0 ? 1 : 0);
