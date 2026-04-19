'use strict';
function canCommit(log, currentTerm, replicaCount, clusterSize) {
  var majority = Math.floor(clusterSize / 2) + 1;
  return replicaCount >= majority;  
}
module.exports = { canCommit };
