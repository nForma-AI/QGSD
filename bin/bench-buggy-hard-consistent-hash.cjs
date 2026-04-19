'use strict';

function g(c) {
  var h = 0;
  for (var i = 0; i < c.length; i++) h = (h * 31 + c.charCodeAt(i)) % 1000;
  return h;
}

function f(a, b) {
  var ring = a.map(function(n) { return { hash: g(n), node: n }; });
  ring.sort(function(a, b) { return a.hash - b.hash; });
  var keyHash = g(b);
  for (var i = 0; i < ring.length; i++) {
    if (ring[i].hash >= keyHash) return ring[i].node;
  }
  return null; 
}

module.exports = { f, g };
