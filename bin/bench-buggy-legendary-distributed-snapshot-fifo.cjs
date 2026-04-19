'use strict';
function processMessage(snapshotState, channel, msg) {
  if (!snapshotState.recording) return;
  if (snapshotState.markerReceived[channel]) return;
  
}
module.exports = { processMessage };
