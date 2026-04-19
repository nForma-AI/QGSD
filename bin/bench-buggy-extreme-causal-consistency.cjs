'use strict';
// Causal consistency check:
// If write W1 causally precedes W2 (W1 → W2), then any client that sees W2 must
// also see W1. The correct check: IF effect is visible THEN cause must be visible.
// Bug: checks the REVERSE direction — IF cause is visible THEN effect must be visible.
// This misses the actual violation (effect visible, cause missing) and instead
// incorrectly flags valid states where a cause is seen without its effect yet.
function isCausallyConsistent(visibleWrites, causalPairs) {
  return causalPairs.every(function(pair) {
    // BUG: wrong direction — checks "cause implies effect" instead of "effect implies cause"
    if (visibleWrites.indexOf(pair.cause) !== -1) {
      return visibleWrites.indexOf(pair.effect) !== -1;
    }
    return true;
  });
}
module.exports = { isCausallyConsistent };
