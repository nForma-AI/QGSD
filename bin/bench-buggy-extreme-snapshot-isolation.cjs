'use strict';
// Snapshot isolation read: return the latest version with commitTs <= readTimestamp.
// Invariant: a read at timestamp T must include all versions committed at exactly T.
// Bug: uses strict less-than (<) instead of <=, so a version committed at exactly T is invisible.
function readSnapshot(versions, readTimestamp) {
  // versions: [{value, commitTs}] sorted ascending by commitTs
  var result = null;
  for (var i = 0; i < versions.length; i++) {
    if (versions[i].commitTs < readTimestamp) { // BUG: should be <=
      result = versions[i].value;
    }
  }
  return result;
}
module.exports = { readSnapshot };
