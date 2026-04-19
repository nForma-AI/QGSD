'use strict';

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  var result = {}; // BUG: always creates plain object, even for arrays
  Object.keys(obj).forEach(function(k) { result[k] = deepClone(obj[k]); });
  return result;
}

module.exports = { deepClone };
