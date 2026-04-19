'use strict';
const { recoverDecision } = require('../../../bin/bench-buggy-legendary-two-pc-recovery.cjs');
let failed = 0;
function assert(label, actual, expected, info) {
  if (actual !== expected) {
    process.stderr.write('FAIL ' + label + ': expected=' + expected + ' actual=' + actual + (info ? ' ' + info : '') + '\n');
    failed++;
  }
}

assert('partial response aborts safely', recoverDecision([{id:1,state:'prepared'}], 3), 'abort');
assert('any committed means commit', recoverDecision([{id:1,state:'committed'},{id:2,state:'prepared'}], 2), 'commit');
assert('all aborted means abort', recoverDecision([{id:1,state:'aborted'},{id:2,state:'aborted'}], 2), 'abort');
assert('partial response with no committed aborts', recoverDecision([{id:1,state:'aborted'}], 2), 'abort');
assert('single participant partial aborts', recoverDecision([], 3), 'abort');

process.exit(failed > 0 ? 1 : 0);
