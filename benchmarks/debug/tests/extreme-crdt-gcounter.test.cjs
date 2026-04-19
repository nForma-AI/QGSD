'use strict';
var { merge, value } = require('../../../bin/bench-buggy-extreme-crdt-gcounter.cjs');
var failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}

// Formal invariant: for all a, b: value(merge(a,b)) >= value(a) AND value(merge(a,b)) >= value(b).
// Also: merge is idempotent: merge(a,a) == a.
// Also: merge is commutative: merge(a,b) == merge(b,a).
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
    var m = merge(a, b);
    var va = value(a), vb = value(b), vm = value(m);
    assert(
      'merge >= a: ' + JSON.stringify(a) + ' merged with ' + JSON.stringify(b),
      vm >= va,
      'merge=' + vm + ' a=' + va
    );
    assert(
      'merge >= b: ' + JSON.stringify(a) + ' merged with ' + JSON.stringify(b),
      vm >= vb,
      'merge=' + vm + ' b=' + vb
    );
    // Commutativity: value(merge(a,b)) === value(merge(b,a))
    var mba = merge(b, a);
    assert(
      'commutative: ' + JSON.stringify(a) + ' ' + JSON.stringify(b),
      value(mba) === vm,
      'merge(a,b)=' + vm + ' merge(b,a)=' + value(mba)
    );
  }
}

// Idempotency: merge(a,a) === a per-node
states.forEach(function(a) {
  var m = merge(a, a);
  Object.keys(a).forEach(function(k) {
    assert('idempotent node ' + k + ' of ' + JSON.stringify(a), m[k] === a[k], 'got ' + m[k]);
  });
});

// Specific violation example: a={n1:3}, b={n1:1} → merge should be {n1:3}, not {n1:1}
var specific = merge({n1: 3}, {n1: 1});
assert('specific: merge({n1:3},{n1:1}).n1 === 3', specific.n1 === 3, 'got ' + specific.n1);

process.exit(failed > 0 ? 1 : 0);
