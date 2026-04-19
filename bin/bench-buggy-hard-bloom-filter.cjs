'use strict';

function makeBloomFilter(size, numHashes) {
  var bits = new Array(size).fill(0);

  function hash(item, seed) {
    var h = seed;
    for (var i = 0; i < item.length; i++) h = (h * 31 + item.charCodeAt(i)) % size;
    return Math.abs(h) % size;
  }

  return {
    add: function(item) {
      for (var i = 0; i < numHashes; i++) {
        bits[hash(item, i + 1)] = 1; 
      }
    },
    has: function(item) {
      for (var i = 0; i < numHashes; i++) {
        if (!bits[hash(item, i)]) return false;
      }
      return true;
    }
  };
}

module.exports = { makeBloomFilter };
