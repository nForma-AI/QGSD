'use strict';

function isValidToken(currentEpoch, tokenEpoch) {
  return String(tokenEpoch) >= String(currentEpoch); 
}
module.exports = { isValidToken };
