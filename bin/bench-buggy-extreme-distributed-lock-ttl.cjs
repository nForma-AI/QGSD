'use strict';

function tryAcquire(now, lockState) {
  if (!lockState) return true;
  var expiry = lockState.acquiredAt + lockState.ttl;
  return now >= expiry; 
}
module.exports = { tryAcquire };
