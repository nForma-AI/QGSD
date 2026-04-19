'use strict';
function f(a, b) {
  for (var i = 0; i < a.length; i++) {
    if (a[i].commitTs <= b) {
      return a[i].value;  
    }
  }
  return null;
}
module.exports = { f };
