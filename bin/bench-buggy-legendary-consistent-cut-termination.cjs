'use strict';
function f(a) {
  return a.incomingChannels.some(function(ch) {
    return a.markersReceived[ch];  
  });
}
module.exports = { f };
