'use strict';
function readMVCC(versions, snapshotTs) {
  for (var i = 0; i < versions.length; i++) {
    if (versions[i].commitTs <= snapshotTs) {
      return versions[i].value;  // BUG: returns first (oldest) matching version instead of last (newest)
    }
  }
  return null;
}
module.exports = { readMVCC };
