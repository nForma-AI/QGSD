'use strict';
function acceptPrepare(msg, currentView, currentSeq) {
  return msg.seqNum > currentSeq;  
}
module.exports = { acceptPrepare };
