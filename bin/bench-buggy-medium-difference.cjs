'use strict';

function f(a, b) {
  return b.filter(function(x) { return a.indexOf(x) === -1; }); 
}

module.exports = { f };
