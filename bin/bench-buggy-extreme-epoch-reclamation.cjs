'use strict';
// Epoch-based memory reclamation:
// An object from epoch E can be safely reclaimed only when ALL active readers
// have advanced their epoch counter to strictly GREATER than E (e > E),
// meaning no reader is still in epoch E.
// Invariant: canReclaim(readerEpochs, reclaimEpoch) iff every reader's epoch > reclaimEpoch.
// Bug: uses <= instead of > — reclaims even when a reader is still AT reclaimEpoch,
// causing use-after-free: the reader is still accessing the object.
function canReclaim(readerEpochs, reclaimEpoch) {
  return readerEpochs.every(function(e) { return e <= reclaimEpoch; }); // BUG: should be e > reclaimEpoch
}
module.exports = { canReclaim };
