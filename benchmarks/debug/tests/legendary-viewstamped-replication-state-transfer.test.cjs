'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-viewstamped-replication-state-transfer.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var a = [{opNum:1,val:'a'},{opNum:2,val:'b'},{opNum:3,val:'c'}];
var transfer = f(a, 3);  // last committed op is op#3
assert('includes last committed op (length=3)', transfer.length, 3);
assert('op 3 included', transfer.some(function(e){return e.opNum===3;}), true);

// Also test boundary
var transfer2 = f(a, 2);
assert('includes up to b=2', transfer2.length, 2);
assert('op 2 included when b=2', transfer2.some(function(e){return e.opNum===2;}), true);

process.exit(failed > 0 ? 1 : 0);
