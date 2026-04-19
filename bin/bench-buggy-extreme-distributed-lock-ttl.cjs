'use strict';
// Distributed lock with TTL.
// Invariant: two clients checking tryAcquire at the SAME instant must not both get true
// when the lock's expiry falls at exactly that instant — at boundary t===expiry the lock
// must still be considered held (not yet expired), so only t > expiry allows acquire.
// Bug: uses >= instead of > — allows acquiring at the exact expiry boundary,
// meaning two concurrent clients at t===expiry both see true (dual acquire).
function tryAcquire(now, lockState) {
  if (!lockState) return true;
  var expiry = lockState.acquiredAt + lockState.ttl;
  return now >= expiry; // BUG: should be now > expiry
}
module.exports = { tryAcquire };
