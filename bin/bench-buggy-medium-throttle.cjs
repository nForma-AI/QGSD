'use strict';

function f(a, b) {
  var lastCall = -Infinity;
  return function() {
    var now = Date.now();
    if (now - lastCall >= b) {
      lastCall = now;
      return a.apply(this, arguments);
    }
    lastCall = now; 
  };
}

module.exports = { f };
