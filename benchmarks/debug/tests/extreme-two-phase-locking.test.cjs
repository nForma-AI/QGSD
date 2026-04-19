'use strict';
var { f } = require('../../../bin/bench-buggy-extreme-two-phase-locking.cjs');
var failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Invariant: canAcquire() must return false after ANY call to release().
// Once the shrinking phase begins, it never ends.

// Basic: can acquire before any release
var tx1 = f();
assert('can acquire initially', tx1.canAcquire() === true, 'got ' + tx1.canAcquire());
tx1.acquire();

// After first release: cannot acquire
tx1.release();
assert('cannot acquire after first release', tx1.canAcquire() === false,
  'canAcquire returned true after release — shrinking phase violated');

// After second release: STILL cannot acquire (bug: toggle flips back to false → canAcquire=true)
tx1.release();
assert('cannot acquire after second release', tx1.canAcquire() === false,
  'canAcquire returned true after 2nd release — toggle bug exposed');

// After third release: still cannot acquire
tx1.release();
assert('cannot acquire after third release', tx1.canAcquire() === false,
  'canAcquire returned true after 3rd release');

// State machine exhaustion: alternate N times
var tx2 = f();
tx2.acquire();
for (var i = 0; i < 6; i++) {
  tx2.release();
  assert('cannot acquire after ' + (i + 1) + ' releases', tx2.canAcquire() === false,
    'canAcquire() = true after ' + (i + 1) + ' releases — invariant violated at odd count');
}

// acquire() itself must return false after release
var tx3 = f();
tx3.acquire();
tx3.release();
assert('acquire() returns false after release', tx3.acquire() === false,
  'acquire() returned true after release');

process.exit(failed > 0 ? 1 : 0);
