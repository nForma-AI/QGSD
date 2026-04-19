'use strict';
function bftQuorumSize(f) {
  return f + 1;  
}
function bftClusterSize(f) {
  return 3 * f + 1;  
}
module.exports = { bftQuorumSize, bftClusterSize };
