'use strict';
function isLinearizable(operations) {
  for (var i = 0; i < operations.length - 1; i++) {
    for (var j = i+1; j < operations.length; j++) {
      var op1 = operations[i], op2 = operations[j];
      if (op1.end < op2.start && op1.seqPos > op2.seqPos) return false;
    }
  }
  return true;  
}
module.exports = { isLinearizable };
