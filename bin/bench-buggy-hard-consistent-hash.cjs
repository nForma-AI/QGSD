'use strict';
// BUG: binary search doesn't wrap around the ring
// When a key hashes to a value greater than all node hashes, the loop exhausts
// and returns null instead of wrapping to the first node
// FIX: change `return null` to `return ring[0].node`

function simpleHash(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
  return h;
}

function consistentHash(nodes, key) {
  var ring = nodes.map(function(n) { return { hash: simpleHash(n), node: n }; });
  ring.sort(function(a, b) { return a.hash - b.hash; });
  var keyHash = simpleHash(key);
  for (var i = 0; i < ring.length; i++) {
    if (ring[i].hash >= keyHash) return ring[i].node;
  }
  return null; // BUG: should wrap around and return ring[0].node
}

module.exports = { consistentHash, simpleHash };
