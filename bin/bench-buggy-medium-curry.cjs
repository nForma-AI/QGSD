'use strict';

function curry(fn) {
  var arity = fn.length;
  return function curried() {
    var args = Array.prototype.slice.call(arguments);
    if (args.length >= arity) return fn.apply(this, args.slice(0, arity));
    return function() {
      return curried.apply(this, args); 
    };
  };
}

module.exports = { curry };
