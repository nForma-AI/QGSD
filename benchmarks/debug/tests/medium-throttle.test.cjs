'use strict';
const { throttle } = require('../../../bin/bench-buggy-medium-throttle.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

var calls = 0;
var fn = function() { calls++; };
var savedNow = Date.now;
var t = 0;
Date.now = function() { return t; };
var throttled = throttle(fn, 100);
t = 0; throttled();    // passes: calls=1, lastCall=0
t = 50; throttled();   // throttled: buggy sets lastCall=50
t = 110; throttled();  // should pass (110-0=110>=100), but buggy: 110-50=60<100 — throttled
Date.now = savedNow;
assert('second window call executes', calls, 2);

process.exit(failed > 0 ? 1 : 0);
