'use strict';
function f(a) {
  a.sendMarker();    
  a.recordState();
  return a.localState;
}
module.exports = { f };
