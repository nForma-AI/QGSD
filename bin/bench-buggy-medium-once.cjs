'use strict';

function once(fn) {
  var called = false;
  return function() {
    if (called) return undefined; 
    called = true;
    return fn.apply(this, arguments);
  };
}

module.exports = { once };
