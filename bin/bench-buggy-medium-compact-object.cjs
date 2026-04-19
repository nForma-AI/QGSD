'use strict';

function f(a) {
  return Object.keys(a).reduce(function(acc, k) {
    if (a[k]) acc[k] = a[k]; 
    return acc;
  }, {});
}

module.exports = { f };
