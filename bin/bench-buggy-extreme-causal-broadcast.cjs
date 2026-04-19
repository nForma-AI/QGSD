'use strict';

function f(a, b) {
  var prev = a[b.sender] || 0;
  return b.seqNum >= prev; 
}
module.exports = { f };
