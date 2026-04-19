'use strict';

function isCausallyConsistent(visibleWrites, causalPairs) {
  return causalPairs.every(function(pair) {
    
    if (visibleWrites.indexOf(pair.cause) !== -1) {
      return visibleWrites.indexOf(pair.effect) !== -1;
    }
    return true;
  });
}
module.exports = { isCausallyConsistent };
