'use strict';
function shouldAcceptWrite(producerEpoch, registeredEpoch) {
  return producerEpoch > registeredEpoch;  
}
module.exports = { shouldAcceptWrite };
