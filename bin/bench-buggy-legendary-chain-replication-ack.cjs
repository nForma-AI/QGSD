'use strict';
function processUpdate(replica, update, sendAckToClient) {
  if (replica.isTail) sendAckToClient(update.id);  // BUG: acks before applying
  replica.storage[update.key] = update.value;
}
module.exports = { processUpdate };
