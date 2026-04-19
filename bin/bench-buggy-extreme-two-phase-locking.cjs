'use strict';
// Two-Phase Locking (2PL): once a transaction releases any lock (shrinking phase begins),
// it must never acquire new locks.
// Invariant: canAcquire() must return false forever once release() has been called.
// Bug: the released flag is TOGGLED (XOR) on each release() call instead of latching to true.
// This means: release → released=true, release again → released=false → canAcquire()=true again.
// Sequence acquire→release→release→acquire is incorrectly permitted.
function makeTransaction() {
  var released = false;
  return {
    acquire: function() {
      if (!released) return true;
      return false;
    },
    release: function() {
      released = !released; // BUG: should be released = true (latch, not toggle)
      return true;
    },
    canAcquire: function() { return !released; }
  };
}
module.exports = { makeTransaction };
