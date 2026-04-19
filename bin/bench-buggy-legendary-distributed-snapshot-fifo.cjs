'use strict';
function processMessage(snapshotState, channel, msg) {
  if (!snapshotState.recording) return;
  if (snapshotState.markerReceived[channel]) return;
  // BUG: doesn't record the message — missing: snapshotState.inTransit.push(msg)
}
module.exports = { processMessage };
