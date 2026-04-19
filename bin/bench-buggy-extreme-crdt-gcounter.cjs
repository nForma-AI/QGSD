'use strict';
// G-Counter CRDT: grow-only counter with per-node slots.
// Invariant: merge(a, b) >= a and merge(a, b) >= b (merge is monotone — value never decreases).
// Bug: merge uses Math.min instead of Math.max, so merged value can be LESS than both inputs.
function merge(counterA, counterB) {
  var result = {};
  var keys = Object.keys(counterA).concat(Object.keys(counterB));
  var allNodes = keys.filter(function(k, i) { return keys.indexOf(k) === i; });
  allNodes.forEach(function(node) {
    result[node] = Math.min(counterA[node] || 0, counterB[node] || 0); // BUG: should be Math.max
  });
  return result;
}
function value(counter) {
  return Object.values(counter).reduce(function(s, x) { return s + x; }, 0);
}
module.exports = { merge, value };
