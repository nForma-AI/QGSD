'use strict';
// Raft leader election: a node must step down when it receives a message from a
// higher term, ensuring at most one leader per term.
// Invariant: shouldStepDown(currentTerm, receivedTerm) iff receivedTerm > currentTerm.
// Bug: uses <= instead of > — inverts the predicate completely.
// Nodes step down for lower-or-equal terms (wrong) and stay up for higher terms (wrong),
// allowing stale leaders to persist and multiple leaders to coexist.
function shouldStepDown(currentTerm, receivedTerm) {
  return receivedTerm <= currentTerm; // BUG: should be receivedTerm > currentTerm
}
module.exports = { shouldStepDown };
