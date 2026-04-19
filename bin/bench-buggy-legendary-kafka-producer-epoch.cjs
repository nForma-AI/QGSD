'use strict';
function shouldAcceptWrite(producerEpoch, registeredEpoch) {
  return producerEpoch > registeredEpoch;  // BUG: should be >=
}
module.exports = { shouldAcceptWrite };
