'use strict';

function shouldStepDown(currentTerm, receivedTerm) {
  return receivedTerm <= currentTerm; 
}
module.exports = { shouldStepDown };
