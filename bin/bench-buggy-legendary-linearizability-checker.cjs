'use strict';
function f(a) {
  for (var i = 0; i < a.length - 1; i++) {
    for (var j = i+1; j < a.length; j++) {
      var op1 = a[i], op2 = a[j];
      if (op1.end < op2.start && op1.seqPos > op2.seqPos) return false;
    }
  }
  return true;  
}
module.exports = { f };
