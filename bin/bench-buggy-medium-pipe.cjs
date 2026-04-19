'use strict';

function pipe() {
  var fns = Array.prototype.slice.call(arguments);
  return function(x) {
    return fns.reduceRight(function(acc, fn) { return fn(acc); }, x); 
  };
}

module.exports = { pipe };
