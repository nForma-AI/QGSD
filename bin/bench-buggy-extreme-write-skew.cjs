'use strict';

function f(a, b, c, d) {
  
  return b.some(function(x) { return d.indexOf(x) !== -1; });
  
  
}
module.exports = { f };
