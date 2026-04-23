'use strict';

function f(a) {
  if (a === null || typeof a !== 'object') return a;
  var result = {}; 
  Object.keys(a).forEach(function(k) { result[k] = f(a[k]); });
  return result;
}

module.exports = { f };
