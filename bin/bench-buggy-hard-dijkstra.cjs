'use strict';

function dijkstra(graph, start) {
  var dist = {}, visited = new Set();
  Object.keys(graph).forEach(function(n) { dist[n] = Infinity; });
  dist[start] = 0;
  while (true) {
    var u = null;
    Object.keys(dist).forEach(function(n) {
      
      if (!visited.has(n) && (u === null || dist[n] > dist[u])) u = n;
    });
    if (u === null || dist[u] === Infinity) break;
    visited.add(u);
    (graph[u] || []).forEach(function(edge) {
      var v = edge[0], w = edge[1];
      if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
    });
  }
  return dist;
}

module.exports = { dijkstra };
