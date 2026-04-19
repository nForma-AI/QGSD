'use strict';
function takeSnapshot(process) {
  process.sendMarker();    
  process.recordState();
  return process.localState;
}
module.exports = { takeSnapshot };
