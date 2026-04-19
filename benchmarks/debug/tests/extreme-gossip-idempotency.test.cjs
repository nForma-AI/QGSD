'use strict';
var { mergeState } = require('../../../bin/bench-buggy-extreme-gossip-idempotency.cjs');
var failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

function deepEqual(a, b) {
  var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.join(',') !== kb.join(',')) return false;
  return ka.every(function(k) { return a[k] === b[k]; });
}

// Formal invariants:
// 1. Idempotency: merge(merge(a,b), b) === merge(a,b)
// 2. Monotonicity: value(merge(a,b)) >= value(a) for all keys
// 3. Commutativity: merge(a,b) has same keys as merge(b,a) with same values

var states = [
  {x: 0, y: 0},
  {x: 1, y: 0},
  {x: 0, y: 2},
  {x: 3, y: 1},
  {x: 2, y: 2}
];

states.forEach(function(a) {
  states.forEach(function(b) {
    var once = mergeState(a, b);
    var twice = mergeState(once, b);

    // Idempotency: applying b again must not change the result
    assert(
      'idempotent: merge(merge(a,b),b)==merge(a,b) a=' + JSON.stringify(a) + ' b=' + JSON.stringify(b),
      deepEqual(once, twice),
      'once=' + JSON.stringify(once) + ' twice=' + JSON.stringify(twice)
    );

    // Monotonicity per key: merge(a,b)[k] >= a[k]
    Object.keys(a).forEach(function(k) {
      assert(
        'monotone key ' + k + ' a=' + JSON.stringify(a) + ' b=' + JSON.stringify(b),
        once[k] >= a[k],
        'merge[' + k + ']=' + once[k] + ' a[' + k + ']=' + a[k]
      );
    });
  });
});

// Specific case: merge({x:2},{x:3}) applied twice should not give x=8
var r1 = mergeState({x: 2}, {x: 3});
assert('first merge x=max(2,3)=3', r1.x === 3, 'got ' + r1.x);
var r2 = mergeState(r1, {x: 3});
assert('idempotent: second merge x still 3', r2.x === 3, 'got ' + r2.x + ' (expected 3, bug gives 6)');

process.exit(failed > 0 ? 1 : 0);
