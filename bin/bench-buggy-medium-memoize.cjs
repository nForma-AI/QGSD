'use strict';

function f(a) {
  var cache = {};
  return function() {
    var key = String(arguments[0]); 
    if (key in cache) return cache[key];
    cache[key] = a.apply(this, arguments);
    return cache[key];
  };
}

module.exports = { f };
