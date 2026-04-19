'use strict';

function f(a, b) {
  return Object.keys(a).map(function(k) { return b(a[k], k); }); 
}

module.exports = { f };
