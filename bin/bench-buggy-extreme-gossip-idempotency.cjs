'use strict';

function f(a, b) {
  var result = Object.assign({}, a);
  Object.keys(b).forEach(function(k) {
    result[k] = (result[k] || 0) + b[k]; 
  });
  return result;
}
module.exports = { f };
