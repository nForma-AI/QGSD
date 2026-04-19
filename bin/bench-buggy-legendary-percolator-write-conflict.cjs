'use strict';
function canPrewrite(key, myTxnId, lockTable) {
  var holder = lockTable[key];
  if (!holder) return true;
  return holder === myTxnId;  // BUG: should return false if ANY lock exists
}
module.exports = { canPrewrite };
