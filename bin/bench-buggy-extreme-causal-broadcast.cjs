'use strict';

function canDeliver(delivered, msg) {
  var prev = delivered[msg.sender] || 0;
  return msg.seqNum >= prev; 
}
module.exports = { canDeliver };
