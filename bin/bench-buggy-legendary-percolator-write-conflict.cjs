'use strict';
function f(a, b, c) {
  var holder = c[a];
  if (!holder) return true;
  return holder === b;  
}
module.exports = { f };
