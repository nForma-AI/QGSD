'use strict';

function memoize(fn) {
  var cache = {};
  return function() {
    var key = String(arguments[0]); // BUG: ignores arguments 1..n
    if (key in cache) return cache[key];
    cache[key] = fn.apply(this, arguments);
    return cache[key];
  };
}

module.exports = { memoize };
