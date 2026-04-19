'use strict';
// Causal broadcast delivery:
// A message from sender with seqNum N can only be delivered when the immediately
// preceding message (seqNum N-1) has already been delivered — i.e., delivered[sender] === N-1.
// Invariant: canDeliver iff msg.seqNum === delivered[sender] + 1 (exactly the next expected).
// Bug: uses >= instead of exact equality — allows delivering out-of-order messages
// (gaps) and re-delivering already-seen messages (duplicates).
function canDeliver(delivered, msg) {
  var prev = delivered[msg.sender] || 0;
  return msg.seqNum >= prev; // BUG: should be msg.seqNum === prev + 1
}
module.exports = { canDeliver };
