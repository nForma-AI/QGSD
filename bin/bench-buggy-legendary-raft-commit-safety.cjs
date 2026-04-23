'use strict';
function f(a, b, c, d) {
  var majority = Math.floor(d / 2) + 1;
  return c >= majority;  
}
module.exports = { f };
