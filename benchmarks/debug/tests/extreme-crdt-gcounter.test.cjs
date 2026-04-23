'use strict';
var { f, g } = require('../../../bin/bench-buggy-extreme-crdt-gcounter.cjs');
var failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Formal invariant: for all a, b: g(f(a,b)) >= g(a) AND g(f(a,b)) >= g(b).
// Also: f is idempotent: f(a,a) == a.
// Also: f is commutative: f(a,b) == f(b,a).
var states = [
  {n1: 0, n2: 0},
  {n1: 1, n2: 0},
  {n1: 0, n2: 1},
  {n1: 2, n2: 1},
  {n1: 1, n2: 3},
  {n1: 5, n2: 0}
];

for (var i = 0; i < states.length; i++) {
  for (var j = 0; j < states.length; j++) {
    var a = states[i], b = states[j];
    var m = f(a, b);
    var va = g(a), vb = g(b), vm = g(m);
    assert(
      'f >= a: ' + JSON.stringify(a) + ' merged with ' + JSON.stringify(b),
      vm >= va,
      'f=' + vm + ' a=' + va
    );
    assert(
      'f >= b: ' + JSON.stringify(a) + ' merged with ' + JSON.stringify(b),
      vm >= vb,
      'f=' + vm + ' b=' + vb
    );
    // Commutativity: g(f(a,b)) === g(f(b,a))
    var mba = f(b, a);
    assert(
      'commutative: ' + JSON.stringify(a) + ' ' + JSON.stringify(b),
      g(mba) === vm,
      'f(a,b)=' + vm + ' f(b,a)=' + g(mba)
    );
  }
}

// Idempotency: f(a,a) === a per-node
states.forEach(function(a) {
  var m = f(a, a);
  Object.keys(a).forEach(function(k) {
    assert('idempotent node ' + k + ' of ' + JSON.stringify(a), m[k] === a[k], 'got ' + m[k]);
  });
});

// Specific violation example: a={n1:3}, b={n1:1} → f should be {n1:3}, not {n1:1}
var specific = f({n1: 3}, {n1: 1});
assert('specific: f({n1:3},{n1:1}).n1 === 3', specific.n1 === 3, 'got ' + specific.n1);

process.exit(failed > 0 ? 1 : 0);
