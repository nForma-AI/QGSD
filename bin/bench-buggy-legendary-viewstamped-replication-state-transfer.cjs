'use strict';
function getStateTransfer(log, lastCommitted) {
  return log.filter(function(entry) {
    return entry.opNum < lastCommitted;  
  });
}
module.exports = { getStateTransfer };
