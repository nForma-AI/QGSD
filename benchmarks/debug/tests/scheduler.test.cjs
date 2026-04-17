'use strict';
// benchmarks/debug/tests/scheduler.test.cjs
// This test FAILS against the buggy stub. Fix: change > to < in comparator.
const { buggyScheduler } = require('../../../bin/bench-buggy-hard-scheduler.cjs');
let failed = 0;
function assert(label, actual, expected) {
  const ok = actual && actual.name === expected;
  if (!ok) { process.stderr.write('FAIL ' + label + ': got ' + JSON.stringify(actual) + ', want name=' + expected + '\n'); failed++; }
}
assert('picks min priority', buggyScheduler([{name:'a',priority:3},{name:'b',priority:1}]), 'b');
assert('single task', buggyScheduler([{name:'x',priority:5}]), 'x');
assert('three tasks', buggyScheduler([{name:'c',priority:2},{name:'a',priority:5},{name:'b',priority:1}]), 'b');
process.exit(failed > 0 ? 1 : 0);
