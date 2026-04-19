'use strict';

function hasQuorum(clusterSize, votes) {
  return votes >= Math.floor(clusterSize / 2);  
}

module.exports = { hasQuorum };
