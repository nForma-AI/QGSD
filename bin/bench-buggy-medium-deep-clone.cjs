'use strict';

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  var result = {}; 
  Object.keys(obj).forEach(function(k) { result[k] = deepClone(obj[k]); });
  return result;
}

module.exports = { deepClone };
