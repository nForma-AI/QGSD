'use strict';
function acceptPrepare(msg, currentView, currentSeq) {
  return msg.seqNum > currentSeq;  // BUG: doesn't check msg.view === currentView
}
module.exports = { acceptPrepare };
