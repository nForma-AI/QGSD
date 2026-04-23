'use strict';

function f(a, b) {
  if (!b) return true;
  var expiry = b.acquiredAt + b.ttl;
  return a >= expiry; 
}
module.exports = { f };
