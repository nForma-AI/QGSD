'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-two-pc-recovery.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

assert('partial response aborts safely', f([{id:1,state:'prepared'}], 3), 'abort');
assert('any committed means commit', f([{id:1,state:'committed'},{id:2,state:'prepared'}], 2), 'commit');
assert('all aborted means abort', f([{id:1,state:'aborted'},{id:2,state:'aborted'}], 2), 'abort');
assert('partial response with no committed aborts', f([{id:1,state:'aborted'}], 2), 'abort');
assert('single participant partial aborts', f([], 3), 'abort');

process.exit(failed > 0 ? 1 : 0);
