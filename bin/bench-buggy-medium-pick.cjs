'use strict';

function f(a, b) {
  return b.reduce(function(acc, k) {
    acc[k] = a[k]; 
    return acc;
  }, {});
}

module.exports = { f };
