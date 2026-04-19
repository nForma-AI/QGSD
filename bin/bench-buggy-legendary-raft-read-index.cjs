'use strict';
function canServeRead(isLeader, appliedIndex, readIndex, heartbeatConfirmed) {
  return isLeader && appliedIndex >= readIndex;  
}
module.exports = { canServeRead };
