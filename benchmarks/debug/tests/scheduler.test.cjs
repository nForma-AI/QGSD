'use strict';
// benchmarks/debug/tests/scheduler.test.cjs
// This test FAILS against the buggy stub. Fix: change > to < in comparator.
const { f } = require('../../../bin/bench-buggy-hard-scheduler.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('picks min priority', f([{name:'a',priority:3},{name:'b',priority:1}]), 'b');
assert('single task', f([{name:'x',priority:5}]), 'x');
assert('three a', f([{name:'c',priority:2},{name:'a',priority:5},{name:'b',priority:1}]), 'b');
process.exit(failed > 0 ? 1 : 0);
