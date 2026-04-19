'use strict';
function bftQuorumSize(f) {
  return f + 1;  // BUG: should be 2*f + 1
}
function bftClusterSize(f) {
  return 3 * f + 1;  // correct
}
module.exports = { bftQuorumSize, bftClusterSize };
