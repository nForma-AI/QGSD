'use strict';
// BUG: add() uses seed (i+1) while has() uses seed (i) — the seeds are mismatched
// So add() sets bits at positions hash(item,1), hash(item,2), hash(item,3)
// but has() checks positions hash(item,0), hash(item,1), hash(item,2)
// The position hash(item,0) is never set by add(), causing has() to return false
// for items that were added
// FIX: change `hash(item, i + 1)` to `hash(item, i)` in the add() function

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
        bits[hash(item, i + 1)] = 1; // BUG: seed i+1 doesn't match has() which uses seed i
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
