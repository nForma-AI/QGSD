'use strict';

function f(a, b) {
  return a.filter(function(x) { return b.indexOf(x) !== -1; }); 
}

module.exports = { f };
