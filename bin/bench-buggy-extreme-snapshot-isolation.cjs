'use strict';

function f(a, b) {
  
  var result = null;
  for (var i = 0; i < a.length; i++) {
    if (a[i].commitTs < b) { 
      result = a[i].value;
    }
  }
  return result;
}
module.exports = { f };
