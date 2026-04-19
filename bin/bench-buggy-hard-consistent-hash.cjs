'use strict';

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
  return null; 
}

module.exports = { consistentHash, simpleHash };
