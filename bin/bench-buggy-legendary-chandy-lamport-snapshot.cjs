'use strict';
function takeSnapshot(process) {
  process.sendMarker();    // BUG: should recordState first, then sendMarker
  process.recordState();
  return process.localState;
}
module.exports = { takeSnapshot };
