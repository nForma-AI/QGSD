'use strict';
function hasWonElection(votesReceived, clusterSize) {
  return votesReceived >= Math.floor(clusterSize / 2);  // BUG: should be > Math.floor(clusterSize/2)
}
module.exports = { hasWonElection };
