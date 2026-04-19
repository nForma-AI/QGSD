'use strict';
function isSnapshotComplete(process) {
  return process.incomingChannels.some(function(ch) {
    return process.markersReceived[ch];  
  });
}
module.exports = { isSnapshotComplete };
