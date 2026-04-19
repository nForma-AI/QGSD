'use strict';
// Paxos Phase 1: a node promises not to accept proposals numbered <= its promisedBallot.
// It responds with a promise only when the incoming ballot is STRICTLY higher.
// Invariant: after promising ballot N, the same node must reject any other proposer also
// presenting ballot N (no two different proposers with the same ballot get a promise).
// Bug: uses >= instead of > — allows equal-ballot proposers to both receive promises
// from the same acceptor, violating the single-promise-per-ballot invariant.
function shouldPromise(ballot, promisedBallot) {
  return ballot >= promisedBallot; // BUG: should be ballot > promisedBallot
}
module.exports = { shouldPromise };
