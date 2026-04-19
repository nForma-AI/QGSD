'use strict';

function mapValues(obj, fn) {
  return Object.keys(obj).map(function(k) { return fn(obj[k], k); }); 
}

module.exports = { mapValues };
