'use strict';

function f(a) {
  var called = false;
  return function() {
    if (called) return undefined; 
    called = true;
    return a.apply(this, arguments);
  };
}

module.exports = { f };
