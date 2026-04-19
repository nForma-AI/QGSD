'use strict';

function once(fn) {
  var called = false;
  return function() {
    if (called) return undefined; // BUG: should return cached result
    called = true;
    return fn.apply(this, arguments);
  };
}

module.exports = { once };
