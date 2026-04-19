'use strict';

function f(a) {
  var arity = a.length;
  return function curried() {
    var args = Array.prototype.slice.call(arguments);
    if (args.length >= arity) return a.apply(this, args.slice(0, arity));
    return function() {
      return curried.apply(this, args); 
    };
  };
}

module.exports = { f };
