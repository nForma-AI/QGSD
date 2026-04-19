'use strict';

function detectConflict(t1Read, t1Write, t2Read, t2Write) {
  
  return t1Write.some(function(x) { return t2Write.indexOf(x) !== -1; });
  
  
}
module.exports = { detectConflict };
