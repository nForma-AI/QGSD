'use strict';
function getStateTransfer(log, lastCommitted) {
  return log.filter(function(entry) {
    return entry.opNum < lastCommitted;  // BUG: should be <= lastCommitted
  });
}
module.exports = { getStateTransfer };
