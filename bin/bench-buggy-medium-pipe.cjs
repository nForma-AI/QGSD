'use strict';

function f() {
  var fns = Array.prototype.slice.call(arguments);
  return function(x) {
    return fns.reduceRight(function(acc, fn) { return fn(acc); }, x); 
  };
}

module.exports = { f };
