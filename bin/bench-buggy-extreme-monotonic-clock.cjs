'use strict';
// Monotonic clock: tracks the highest timestamp seen.
// Invariant: read() should always return a value >= any previously read value (monotonicity).
// Bug: uses Math.min instead of Math.max — clock shrinks when a lower timestamp is observed.
function makeMonotonicClock() {
  var current = 0;
  return {
    update: function(t) {
      current = Math.min(current, t); // BUG: should be Math.max
    },
    read: function() { return current; }
  };
}
module.exports = { makeMonotonicClock };
