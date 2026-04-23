'use strict';

function f(a, b) {
  return a.every(function(e) { return e <= b; }); 
}
module.exports = { f };
