'use strict';

function f(a, b) {
  var dist = {}, visited = new Set();
  Object.keys(a).forEach(function(n) { dist[n] = Infinity; });
  dist[b] = 0;
  while (true) {
    var u = null;
    Object.keys(dist).forEach(function(n) {
      
      if (!visited.has(n) && (u === null || dist[n] > dist[u])) u = n;
    });
    if (u === null || dist[u] === Infinity) break;
    visited.add(u);
    (a[u] || []).forEach(function(edge) {
      var v = edge[0], w = edge[1];
      if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
    });
  }
  return dist;
}

module.exports = { f };
