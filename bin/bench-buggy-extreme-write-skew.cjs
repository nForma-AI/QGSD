'use strict';
// Write skew anomaly detection:
// Write skew occurs when two concurrent transactions T1 and T2 each read overlapping
// data and write to NON-overlapping keys, but their combined effect violates a constraint.
// Formal check: conflict exists if T1's write set intersects T2's READ set, OR
//               T2's write set intersects T1's READ set (read-write anti-dependency).
// Bug: only checks write-write overlap (dirty write detection), which misses write skew
// entirely since T1 and T2 write to DIFFERENT keys by definition of write skew.
function detectConflict(t1Read, t1Write, t2Read, t2Write) {
  // BUG: checks write-write overlap instead of write-read anti-dependency
  return t1Write.some(function(x) { return t2Write.indexOf(x) !== -1; });
  // Correct: return t1Write.some(x => t2Read.indexOf(x) !== -1) ||
  //                 t2Write.some(x => t1Read.indexOf(x) !== -1);
}
module.exports = { detectConflict };
