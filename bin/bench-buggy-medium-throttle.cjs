'use strict';

function throttle(fn, delay) {
  var lastCall = -Infinity;
  return function() {
    var now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return fn.apply(this, arguments);
    }
    lastCall = now; 
  };
}

module.exports = { throttle };
