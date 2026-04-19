'use strict';
// Gossip state merge: applying the same remote state twice should produce the same result
// as applying it once (idempotency). This requires taking the MAX of each key, not adding.
// Invariant: merge(merge(a, b), b) deepEquals merge(a, b) for all a, b.
// Bug: uses addition (+) instead of Math.max — applying remote state multiple times
// inflates the counters, violating idempotency.
function mergeState(local, remote) {
  var result = Object.assign({}, local);
  Object.keys(remote).forEach(function(k) {
    result[k] = (result[k] || 0) + remote[k]; // BUG: + instead of Math.max (not idempotent)
  });
  return result;
}
module.exports = { mergeState };
