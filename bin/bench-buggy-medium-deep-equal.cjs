'use strict';

function f(a, b) {
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  var ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(function(k) { return a[k] === b[k]; }); 
}

module.exports = { f };
