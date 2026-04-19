'use strict';
// BUG: neighbors are pushed to queue without checking visited, causing duplicates in output
// FIX: add `if (!visited.has(neighbor))` check before queue.push(neighbor)

function bfs(graph, start) {
  var visited = new Set([start]);
  var queue = [start];
  var result = [];
  while (queue.length > 0) {
    var node = queue.shift();
    result.push(node);
    (graph[node] || []).forEach(function(neighbor) {
      queue.push(neighbor); // BUG: should check visited before pushing
      visited.add(neighbor);
    });
  }
  return result;
}

module.exports = { bfs };
