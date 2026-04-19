'use strict';
var { makeMonotonicClock } = require('../../../bin/bench-buggy-extreme-monotonic-clock.cjs');
var failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// Invariant: after any sequence of updates, clock value must be >= its previous value.
// Also: final value must be the maximum of all updates.
var updates = [5, 3, 8, 1, 6];
var c = makeMonotonicClock();
var prev = 0;
for (var i = 0; i < updates.length; i++) {
  c.update(updates[i]);
  var cur = c.read();
  assert('monotonic after update ' + updates[i], cur >= prev, 'clock went from ' + prev + ' to ' + cur);
  prev = cur;
}
// Buggy: Math.min(0,5)=0, Math.min(0,3)=0 ... stays at 0 the whole time.
// Final value must be the global maximum = 8.
assert('final value is max of all updates', c.read() === 8, 'got ' + c.read());

// Additional: monotonicity over decreasing sequence
var c2 = makeMonotonicClock();
c2.update(10);
var v1 = c2.read();
c2.update(7);
assert('no regression on lower update', c2.read() >= v1, 'was ' + v1 + ' got ' + c2.read());
c2.update(15);
assert('advances on higher update', c2.read() >= 10, 'expected >=10 got ' + c2.read());

// Enumerate all permutations of [1,2,3] and verify monotonicity at each step
var perms = [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]];
perms.forEach(function(perm) {
  var cp = makeMonotonicClock();
  var p = 0;
  perm.forEach(function(val) {
    cp.update(val);
    var v = cp.read();
    assert('monotonic perm ' + JSON.stringify(perm) + ' after ' + val, v >= p, 'from ' + p + ' to ' + v);
    p = v;
  });
  assert('max of perm ' + JSON.stringify(perm), cp.read() === 3, 'got ' + cp.read());
});

process.exit(failed > 0 ? 1 : 0);
