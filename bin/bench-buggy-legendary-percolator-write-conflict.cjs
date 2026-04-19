'use strict';
function canPrewrite(key, myTxnId, lockTable) {
  var holder = lockTable[key];
  if (!holder) return true;
  return holder === myTxnId;  
}
module.exports = { canPrewrite };
