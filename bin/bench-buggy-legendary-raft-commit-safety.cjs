'use strict';
function canCommit(log, currentTerm, replicaCount, clusterSize) {
  var majority = Math.floor(clusterSize / 2) + 1;
  return replicaCount >= majority;  // BUG: doesn't check that the entry IS from current term
}
module.exports = { canCommit };
