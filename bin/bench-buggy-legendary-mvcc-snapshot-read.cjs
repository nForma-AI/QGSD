'use strict';
function readMVCC(versions, snapshotTs) {
  for (var i = 0; i < versions.length; i++) {
    if (versions[i].commitTs <= snapshotTs) {
      return versions[i].value;  
    }
  }
  return null;
}
module.exports = { readMVCC };
