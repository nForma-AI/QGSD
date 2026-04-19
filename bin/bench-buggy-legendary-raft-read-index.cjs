'use strict';
function canServeRead(isLeader, appliedIndex, readIndex, heartbeatConfirmed) {
  return isLeader && appliedIndex >= readIndex;  // BUG: doesn't require heartbeatConfirmed
}
module.exports = { canServeRead };
