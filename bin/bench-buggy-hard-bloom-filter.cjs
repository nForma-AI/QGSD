'use strict';

function f(a, b) {
  var bits = new Array(a).fill(0);

  function hash(item, seed) {
    var h = seed;
    for (var i = 0; i < item.length; i++) h = (h * 31 + item.charCodeAt(i)) % a;
    return Math.abs(h) % a;
  }

  return {
    add: function(item) {
      for (var i = 0; i < b; i++) {
        bits[hash(item, i + 1)] = 1; 
      }
    },
    has: function(item) {
      for (var i = 0; i < b; i++) {
        if (!bits[hash(item, i)]) return false;
      }
      return true;
    }
  };
}

module.exports = { f };
