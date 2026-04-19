'use strict';
// Monotonic reads: a client's reads must never go backwards in time.
// Invariant: isValidRead(prev, new) iff new >= prev.
// Bug: ignores prevReadTs entirely — accepts any positive newReadTs as valid,
// so stale reads (newReadTs < prevReadTs) are incorrectly permitted.
function isValidRead(prevReadTs, newReadTs) {
  return newReadTs > 0; // BUG: should be newReadTs >= prevReadTs
}
module.exports = { isValidRead };
