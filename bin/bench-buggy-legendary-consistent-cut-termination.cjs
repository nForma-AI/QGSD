'use strict';
function isSnapshotComplete(process) {
  return process.incomingChannels.some(function(ch) {
    return process.markersReceived[ch];  // BUG: should be .every()
  });
}
module.exports = { isSnapshotComplete };
